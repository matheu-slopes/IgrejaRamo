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

async function dispatchToSubs(subs: SubRow[], payload: PushPayload) {
  if (!subs.length) return;
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch((err) => {
          // Subscription expired — remove
          if (err.statusCode === 410 || err.statusCode === 404) {
            admin
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint)
              .then(() => {});
            return;
          }

          console.error("push send error:", err?.statusCode ?? "unknown", err?.message ?? err);
        })
    )
  );
}

/** Envia push para usuários específicos (por ID) */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;
  const uniqueUserIds = [...new Set(userIds)];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds);
  await dispatchToSubs((subs as SubRow[]) ?? [], payload);
}

/** Envia push para todos os usuários cadastrados */
export async function sendPushToAll(payload: PushPayload) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  await dispatchToSubs((subs as SubRow[]) ?? [], payload);
}
