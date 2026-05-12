"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Registra o Service Worker, pede permissão de notificações e salva
 * a subscription push do usuário no banco via /api/push/subscribe.
 * Deve ser montado uma vez dentro do dashboard (layout autenticado).
 */
export default function PushSubscriber() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    subscribedRef.current = true;

    async function subscribe() {
      try {
        // Aguarda o SW estar pronto
        const registration = await navigator.serviceWorker.ready;

        // Se já tem subscription ativa, apenas sincroniza com o servidor
        let sub = await registration.pushManager.getSubscription();

        if (!sub) {
          // Pede permissão — silencioso se já foi concedida
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;

          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
          });
        }

        // Salva no servidor
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const key = sub.getKey("p256dh");
        const auth = sub.getKey("auth");
        if (!key || !auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          }),
        });
      } catch (e) {
        console.error("PushSubscriber error:", e);
      }
    }

    subscribe();
  }, [user]);

  return null;
}

/** Converte base64url para Uint8Array (necessário para applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
