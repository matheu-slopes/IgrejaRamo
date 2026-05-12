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
  const [erro, setErro] = useState<string | null>(null);

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
      // Se falhar, mostra o banner com o erro para o usuário poder tentar de novo
      registrarSubscription().catch((e) => {
        console.error("PushSubscriber (silent):", e);
        setErro("Erro ao registrar subscription: " + String(e));
        setMostrarBanner(true);
      });
    }
  }, [user]);

  async function solicitarPermissao() {
    setLoading(true);
    setErro(null);
    setMostrarBanner(false); // fecha imediatamente ao clicar
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registrarSubscription();
      } else {
        setErro("Permissão negada. Habilite manualmente nas configurações do navegador.");
        setMostrarBanner(true); // reabre só se negou
      }
    } catch (e) {
      console.error("PushSubscriber.solicitarPermissao:", e);
      setErro(String(e).replace("Error: ", ""));
      setMostrarBanner(true); // reabre com o erro
    } finally {
      setLoading(false);
    }
  }

  async function registrarSubscription() {
    // Aguarda o SW ficar ativo com timeout de 10s
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Service Worker demorou demais para ficar ativo. Tente recarregar a página.")), 10000)
      ),
    ]);

    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error("Chave VAPID não configurada. Contate o administrador.");
      }
      // Passa o Uint8Array diretamente (não .buffer) — exigido pela spec do Web Push
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const key = sub.getKey("p256dh");
    const auth = sub.getKey("auth");
    if (!key || !auth) {
      throw new Error("Erro ao obter chaves de criptografia da subscription.");
    }

    const res = await fetch("/api/push/subscribe", {
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Erro ${res.status} ao salvar subscription: ${data.error ?? "desconhecido"}`);
    }

    // Sucesso — fecha o banner
    setErro(null);
    setMostrarBanner(false);
  }

  if (!mostrarBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm flex flex-col gap-2">
      {erro && (
        <div className="bg-red-600 text-white rounded-xl shadow-lg px-3 py-2 text-xs leading-snug">
          ⚠️ {erro}
        </div>
      )}
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

