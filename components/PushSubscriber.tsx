"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Bell, X } from "lucide-react";

/**
 * Exibe um banner pedindo permissão de notificações (requer gesto do usuário).
 * Registra a subscription push no banco via /api/push/subscribe.
 */
export default function PushSubscriber() {
  const { user } = useAuth();
  const checkedRef = useRef(false);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || checkedRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    checkedRef.current = true;

    // Só mostra o banner se a permissão ainda não foi definida
    if (Notification.permission === "default") {
      // Pequeno delay para não assustar o usuário logo ao entrar
      setTimeout(() => setMostrarBanner(true), 3000);
    } else if (Notification.permission === "granted") {
      // Permissão já concedida — garante que a subscription está salva
      registrarSubscription().catch(console.error);
    }
  }, [user]);

  async function solicitarPermissao() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registrarSubscription();
      }
    } catch (e) {
      console.error("PushSubscriber.solicitarPermissao:", e);
    } finally {
      setLoading(false);
      setMostrarBanner(false);
    }
  }

  async function registrarSubscription() {
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
    }

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
  }

  if (!mostrarBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-vine-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-vine-700 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Ativar notificações</p>
          <p className="text-xs text-vine-200 leading-tight mt-0.5">Receba avisos, mensagens e lembretes de escala</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={solicitarPermissao}
            disabled={loading}
            className="bg-white text-vine-900 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-vine-100 transition disabled:opacity-60"
          >
            {loading ? "..." : "Ativar"}
          </button>
          <button
            onClick={() => setMostrarBanner(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-vine-800 transition"
          >
            <X className="w-3.5 h-3.5 text-vine-300" />
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

