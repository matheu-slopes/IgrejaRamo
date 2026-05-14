"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Bell, Check, X } from "lucide-react";

export default function PushSubscriber() {
  const { user } = useAuth();
  const checkedRef = useRef(false);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sucesso" | "erro">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user || checkedRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;
    checkedRef.current = true;

    if (Notification.permission === "default") {
      setTimeout(() => setMostrarBanner(true), 3000);
    } else if (Notification.permission === "granted") {
      // Já permitiu — tenta registrar silenciosamente
      registrarSubscription().catch((e) => {
        console.error("PushSubscriber (background):", e);
        // Só mostra banner se falhou (ex: subscription ainda não está salva)
        setMsg(String(e).replace("Error: ", ""));
        setStatus("erro");
        setMostrarBanner(true);
      });
    }
  }, [user]);

  async function ativar() {
    if (status === "loading") return;
    setStatus("loading");
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("erro");
        setMsg("Permissão negada. Vá em Configurações → Notificações para habilitar.");
        return;
      }
      await registrarSubscription();
    } catch (e) {
      console.error("PushSubscriber.ativar:", e);
      setStatus("erro");
      setMsg(String(e).replace("Error: ", ""));
    }
  }

  async function registrarSubscription() {
    const registration = await getServiceWorkerRegistration();
    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Chave VAPID ausente. Contate o administrador.");
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as Uint8Array<ArrayBuffer>,
      });
    }

    // sub.toJSON().keys retorna base64url (formato correto para web-push no servidor)
    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? "";
    const authKey = json.keys?.auth ?? "";
    if (!p256dh || !authKey) throw new Error("Não foi possível obter as chaves da subscription.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada. Faça login novamente.");

    // Salva diretamente no Supabase (cliente autenticado, RLS aplica automaticamente)
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh, auth: authKey },
      { onConflict: "user_id,endpoint" }
    );

    if (error) throw new Error(`Erro ao salvar: ${error.message}`);

    setStatus("sucesso");
    setMsg(null);
    setTimeout(() => setMostrarBanner(false), 2000);
  }

  if (!mostrarBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-vine-900 text-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Linha de progresso durante loading */}
        {status === "loading" && (
          <div className="h-0.5 bg-vine-700">
            <div className="h-full bg-white animate-pulse w-full" />
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            status === "sucesso" ? "bg-green-600" : status === "erro" ? "bg-red-600" : "bg-vine-700"
          }`}>
            {status === "sucesso" ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0">
            {status === "idle" && (
              <>
                <p className="text-sm font-semibold leading-tight">Ativar notificações</p>
                <p className="text-xs text-vine-200 leading-tight mt-0.5">Receba avisos, mensagens e lembretes de escala</p>
              </>
            )}
            {status === "loading" && (
              <>
                <p className="text-sm font-semibold leading-tight">Ativando…</p>
                <p className="text-xs text-vine-200 leading-tight mt-0.5">Aguarde, pode demorar alguns segundos</p>
              </>
            )}
            {status === "sucesso" && (
              <p className="text-sm font-semibold leading-tight">Notificações ativadas! ✓</p>
            )}
            {status === "erro" && (
              <>
                <p className="text-sm font-semibold leading-tight text-red-300">Não foi possível ativar</p>
                {msg && <p className="text-[11px] text-red-200 leading-tight mt-0.5 break-words">{msg}</p>}
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {status !== "loading" && status !== "sucesso" && (
              <button
                onClick={ativar}
                className="bg-white text-vine-900 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-vine-100 transition"
              >
                {status === "erro" ? "Tentar novamente" : "Ativar"}
              </button>
            )}
            {status !== "loading" && (
              <button
                onClick={() => setMostrarBanner(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-vine-800 transition"
              >
                <X className="w-3.5 h-3.5 text-vine-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador não suporta Service Worker.");
  }

  let registration = await navigator.serviceWorker.getRegistration();

  // Em alguns navegadores mobile a registration pode não existir ainda.
  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js");
  }

  const timeoutMs = 10000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          "Tempo esgotado ao iniciar notificações. Atualize a página e tente novamente."
        )
      );
    }, timeoutMs);
  });

  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    timeoutPromise,
  ]);

  return (readyRegistration as ServiceWorkerRegistration) || registration;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

