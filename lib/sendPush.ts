import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:admin@ramoda.vida",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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
  errors: Array<{ status: number | "unknown"; message: string }>;
};

async function dispatchToSubs(subs: SubRow[], payload: PushPayload): Promise<PushDispatchResult> {
  const result: PushDispatchResult = {
    attempted: subs.length,
    sent: 0,
    failed: 0,
    removed: 0,
    errors: [],
  };

  if (!subs.length) return result;

  await Promise.allSettled(
    subs.map(async (sub) => {
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
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        const status = (err as { statusCode?: number })?.statusCode ?? "unknown";
        const message = String((err as { message?: string })?.message ?? err ?? "erro desconhecido");
        result.errors.push({ status, message });

        // Subscription expired — remove
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
          msg.includes("auth") ||
          msg.includes("must be") ||
          msg.includes("base64url");
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
