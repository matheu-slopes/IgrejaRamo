import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const vapidSubject =
  process.env.VAPID_SUBJECT ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://igreja-ramo.vercel.app";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const hasVapidKeys = Boolean(vapidPublicKey && vapidPrivateKey);

if (hasVapidKeys) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey!,
    vapidPrivateKey!
  );
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type SubRow = { endpoint: string; p256dh: string; auth: string };

export type PushDispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  removed: number;
  errors: Array<{ status: number | "unknown"; message: string; endpointHost?: string }>;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientPushError(status: number | "unknown", message: string) {
  if (status === "unknown") return true;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  const m = message.toLowerCase();
  return m.includes("timeout") || m.includes("econnreset") || m.includes("temporar");
}

async function dispatchToSubs(subs: SubRow[], payload: PushPayload): Promise<PushDispatchResult> {
  const result: PushDispatchResult = {
    attempted: subs.length,
    sent: 0,
    failed: 0,
    removed: 0,
    errors: [],
  };

  if (!hasVapidKeys) {
    result.errors.push({
      status: "unknown",
      message: "VAPID keys ausentes no ambiente. Envio de push ignorado.",
    });
    return result;
  }

  if (!subs.length) return result;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        let delivered = false;
        let lastStatus: number | "unknown" = "unknown";
        let lastMessage = "";

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(payload),
              {
                // Mantém a notificação em fila por mais tempo para cenários com
                // celular bloqueado/offline temporário.
                TTL: 60 * 60 * 24,
                urgency: "high",
                // Evita travar envio indefinidamente para endpoints instáveis.
                timeout: 15000,
              }
            );
            delivered = true;
            break;
          } catch (err) {
            lastStatus = (err as { statusCode?: number })?.statusCode ?? "unknown";
            lastMessage = String((err as { message?: string })?.message ?? err ?? "erro desconhecido");
            if (attempt < 3 && isTransientPushError(lastStatus, lastMessage)) {
              await wait(attempt * 250);
              continue;
            }
            throw err;
          }
        }

        if (!delivered) {
          throw new Error(`push não entregue: ${lastStatus} ${lastMessage}`);
        }

        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        const status = (err as { statusCode?: number })?.statusCode ?? "unknown";
        const rawMessage = String((err as { message?: string })?.message ?? err ?? "erro desconhecido");
        const body = String((err as { body?: string })?.body ?? "").trim();
        const message = body ? `${rawMessage}: ${body.slice(0, 500)}` : rawMessage;
        let endpointHost: string | undefined;
        try {
          endpointHost = new URL(sub.endpoint).host;
        } catch {
          endpointHost = "endpoint_invalido";
        }
        result.errors.push({ status, message, endpointHost });

        // Subscription expired / inválida — remove
        // 403 costuma ser VAPID/subject recusado pelo push service. Não removemos
        // automaticamente para não apagar uma subscription válida durante diagnóstico.
        if (status === 410 || status === 404) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          result.removed += 1;
          return;
        }

        // Remove subscriptions com chaves inválidas para evitar falha recorrente.
        const msg = message.toLowerCase();
        const invalidKey =
          msg.includes("p256dh") ||
          msg.includes("base64url") ||
          (msg.includes("invalid") && msg.includes("public key"));
        if (invalidKey) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          result.removed += 1;
        }

        console.error("push send error:", status, message);
      }
    })
  );

  return result;
}

/** Envia push para usuários específicos (por ID) */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushDispatchResult> {
  if (!userIds.length) {
    return { attempted: 0, sent: 0, failed: 0, removed: 0, errors: [] };
  }
  const uniqueUserIds = [...new Set(userIds)];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds);
  return dispatchToSubs((subs as SubRow[]) ?? [], payload);
}

/** Envia push para todos os usuários cadastrados */
export async function sendPushToAll(payload: PushPayload): Promise<PushDispatchResult> {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  return dispatchToSubs((subs as SubRow[]) ?? [], payload);
}
