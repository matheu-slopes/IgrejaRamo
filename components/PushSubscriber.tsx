"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Bell, Check, X } from "lucide-react";

export default function PushSubscriber() {
  const { user } = useAuth();
  const buildVapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [runtimeVapidPublicKey, setRuntimeVapidPublicKey] = useState<string | null>(null);
  const vapidPublicKey = buildVapidPublicKey || runtimeVapidPublicKey || "";
  const pushConfigured = Boolean(vapidPublicKey);
  const lastAttemptRef = useRef(0);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sucesso" | "erro">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (buildVapidPublicKey) return;
    let cancelled = false;

    async function loadRuntimeVapidKey() {
      try {
        const res = await fetch("/api/push/public-key", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const key = typeof json.publicKey === "string" ? json.publicKey.trim() : "";
        if (!cancelled && key) setRuntimeVapidPublicKey(key);
      } catch (e) {
        console.error("PushSubscriber public key:", e);
      }
    }

    loadRuntimeVapidKey();
    return () => { cancelled = true; };
  }, [buildVapidPublicKey]);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!pushConfigured) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    const podeTentar = () => {
      const now = Date.now();
      // Evita spam de tentativas em background.
      if (now - lastAttemptRef.current < 30_000) return false;
      lastAttemptRef.current = now;
      return true;
    };

    const registrarSilencioso = async (mostrarErroNoBanner = false) => {
      if (!podeTentar()) return;
      try {
        await registrarSubscription({ silent: true });
      } catch (e) {
        console.error("PushSubscriber (background):", e);
        if (mostrarErroNoBanner) {
          setMsg(String(e).replace("Error: ", ""));
          setStatus("erro");
          setMostrarBanner(true);
        }
      }
    };

    if (Notification.permission === "default") {
      setTimeout(() => setMostrarBanner(true), 3000);
    } else if (Notification.permission === "granted") {
      // Já permitiu: registra automaticamente sem exigir clique manual.
      registrarSilencioso(true);
    }

    const onFocus = () => {
      if (Notification.permission === "granted") registrarSilencioso(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Notification.permission === "granted") {
        registrarSilencioso(false);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (Notification.permission === "granted") {
        registrarSilencioso(false);
      }
    }, 120_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [pushConfigured, user]);

  async function ativar() {
    if (status === "loading") return;
    if (!pushConfigured) {
      setStatus("erro");
      setMsg("Notificações indisponíveis no momento. Contate o administrador.");
      setMostrarBanner(true);
      return;
    }
    setStatus("loading");
    setMsg(null);
    try {
      const supportError = getPushSupportError();
      if (supportError) {
        throw new Error(supportError);
      }

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

  async function registrarSubscription(opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setStatus("loading");
      setMsg(null);
    }

    const vapidKey = vapidPublicKey;
    if (!vapidKey) {
      if (silent) return;
      throw new Error("Notificações indisponíveis no momento. Contate o administrador.");
    }

    const registration = await getServiceWorkerRegistration();
    let sub = await registration.pushManager.getSubscription();
    const expectedKey = urlBase64ToUint8Array(vapidKey);

    if (sub && shouldRenewSubscription(sub, expectedKey, user?.id)) {
      try {
        await sub.unsubscribe();
      } catch {
        // segue para nova tentativa de subscribe
      }
      sub = null;
    }

    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKey as unknown as Uint8Array<ArrayBuffer>,
      });
    }

    // sub.toJSON().keys retorna base64url (formato correto para web-push no servidor)
    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? "";
    const authKey = json.keys?.auth ?? "";
    if (!p256dh || !authKey) throw new Error("Não foi possível obter as chaves da subscription.");

    let token = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      
      // Valida e renova o token se estiver próximo do vencimento
      const expiresAt = session.expires_at ?? 0;
      if (Date.now() / 1000 > expiresAt - 60) {
        const { data } = await supabase.auth.refreshSession();
        token = data.session?.access_token ?? "";
        if (!token) throw new Error("Falha ao renovar sessão.");
      } else {
        token = session.access_token;
      }
    } catch (e) {
      throw new Error(`Erro de autenticação: ${String(e).replace("Error: ", "")}`);
    }

    // Salva no backend com service role para evitar falhas de RLS entre ambientes.
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh,
        auth: authKey,
      }),
    });

    const jsonRes = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(jsonRes.error ?? "Falha ao registrar notificação.");
    }

    if (user?.id) {
      try {
        localStorage.setItem(`push_registered_at_${user.id}`, String(Date.now()));
      } catch {
        // ignore localStorage failures
      }
    }

    setStatus("sucesso");
    setMsg(null);
    setTimeout(() => setMostrarBanner(false), 2000);
  }

  if (!mostrarBanner) return null;
  // Enquanto o prompt nativo de permissão do OS pode estar visível, oculta o
  // banner para evitar sobreposição e o efeito de "empurrar a nav".
  if (status === "loading") return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm md:bottom-6"
      style={{
        // mobile: flutua acima da BottomNav (altura ~3.5rem) + safe-area-inset-bottom
        bottom: "clamp(5rem, calc(3.5rem + env(safe-area-inset-bottom) + 0.75rem), 12rem)",
      }}
    >
      <div className="bg-vine-900 text-white rounded-2xl shadow-2xl overflow-hidden">
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
            {status !== "sucesso" && (
              <button
                onClick={ativar}
                className="bg-white text-vine-900 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-vine-100 transition"
              >
                {status === "erro" ? "Tentar novamente" : "Ativar"}
              </button>
            )}
            <button
              onClick={() => setMostrarBanner(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-vine-800 transition"
            >
              <X className="w-3.5 h-3.5 text-vine-300" />
            </button>
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

  const expectedScript = "/sw.js";
  let registration = await navigator.serviceWorker.getRegistration("/");

  // Limpa service workers antigos/incompatíveis que podem capturar a subscription errada.
  if (registration?.active?.scriptURL && !registration.active.scriptURL.endsWith(expectedScript)) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    } catch {
      // continua para registrar o worker correto
    }
    registration = undefined;
  }

  // Em alguns navegadores mobile a registration pode não existir ainda.
  if (!registration) {
    registration = await navigator.serviceWorker.register(expectedScript, { scope: "/" });
  }

  try {
    await registration.update();
  } catch {
    // update pode falhar offline; segue com o registro existente
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

  const activeRegistration = (readyRegistration as ServiceWorkerRegistration) || registration;
  if (!activeRegistration.active) {
    throw new Error("Service Worker ainda não está ativo. Feche e abra o app e tente novamente.");
  }

  return activeRegistration;
}

function getPushSupportError(): string | null {
  if (typeof window === "undefined") return "";

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // Safari iOS legado
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // No iOS, Web Push só funciona no app instalado na Tela de Início.
  if (isIOS && !isStandalone) {
    return "No iPhone, ative no app instalado: Compartilhar → Adicionar à Tela de Início.";
  }

  if (!window.isSecureContext) {
    return "Notificações exigem conexão segura (HTTPS).";
  }

  if (!("Notification" in window)) {
    return "Este navegador não suporta notificações.";
  }

  if (!("serviceWorker" in navigator)) {
    return "Este navegador não suporta Service Worker.";
  }

  if (!("PushManager" in window)) {
    return "Este navegador não suporta Push API.";
  }

  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function shouldRenewSubscription(sub: PushSubscription, expectedKey: Uint8Array, userId?: string): boolean {
  // Renova quando a chave VAPID do app mudou em relação à subscription existente.
  const currentKeyBuffer = sub.options?.applicationServerKey;
  const currentKey = currentKeyBuffer ? new Uint8Array(currentKeyBuffer as ArrayBuffer) : null;
  const keyMismatch =
    !currentKey ||
    currentKey.length !== expectedKey.length ||
    currentKey.some((byte, i) => byte !== expectedKey[i]);
  if (keyMismatch) return true;

  // Renova periodicamente para evitar endpoint envelhecido no mobile.
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(`push_registered_at_${userId}`);
    const lastTs = raw ? Number(raw) : 0;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return !lastTs || Date.now() - lastTs > sevenDays;
  } catch {
    return false;
  }
}

