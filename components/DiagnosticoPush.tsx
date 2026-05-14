"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Send, Trash2 } from "lucide-react";

interface StatusPush {
  vapid_public_key_set: boolean;
  vapid_private_key_set: boolean;
  next_public_vapid_key_set: boolean;
  service_role_key_set: boolean;
  autenticado: boolean;
  user_id?: string;
  suas_subscriptions: { id: string; endpoint: string; criado_em: string }[];
  suas_subscriptions_count: number;
  total_subscriptions_sistema: number;
  erro_subs?: string;
  erro_auth?: string;
}

interface DeviceStatus {
  permission: string;
  swScript: string | null;
  swState: string | null;
  endpointHost: string | null;
  endpointTail: string | null;
  hasSubscription: boolean;
  standalone: boolean;
}

async function getFreshToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index++) outputArray[index] = rawData.charCodeAt(index);
  return outputArray;
}

async function getDeviceStatus(): Promise<DeviceStatus> {
  let swScript: string | null = null;
  let swState: string | null = null;
  let endpointHost: string | null = null;
  let endpointTail: string | null = null;
  let hasSubscription = false;

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) {
      swScript = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? null;
      swState = registration.active?.state ?? registration.waiting?.state ?? registration.installing?.state ?? null;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        hasSubscription = true;
        endpointTail = subscription.endpoint.slice(-12);
        try {
          endpointHost = new URL(subscription.endpoint).host;
        } catch {
          endpointHost = "endpoint inválido";
        }
      }
    }
  }

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;

  return {
    permission: "Notification" in window ? Notification.permission : "indisponível",
    swScript,
    swState,
    endpointHost,
    endpointTail,
    hasSubscription,
    standalone,
  };
}

async function getReadyPushRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este aparelho não suporta Service Worker.");
  }

  const expectedScript = "/sw.js";
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? "";
    if (script && !script.endsWith(expectedScript)) {
      await registration.unregister().catch(() => undefined);
    }
  }

  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration || !registration.active?.scriptURL.endsWith(expectedScript)) {
    registration = await navigator.serviceWorker.register(expectedScript, { scope: "/" });
  }

  await registration.update().catch(() => undefined);
  const ready = await navigator.serviceWorker.ready;
  if (!ready.active) {
    throw new Error("O Service Worker ainda não ficou ativo. Feche e abra o app e tente de novo.");
  }
  return ready;
}

export function DiagnosticoPush() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusPush | null>(null);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"clean" | "test" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function verificar() {
    setLoading(true);
    setErro(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErro("Não autenticado");
        return;
      }

      const token = await getFreshToken();
      if (!token) throw new Error("Falha ao renovar sessão");

      const res = await fetch("/api/push/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: StatusPush = await res.json();
      setStatus(json);

      if (!res.ok) {
        setErro(json.erro_auth ?? "Erro ao obter status");
      }
      setDevice(await getDeviceStatus());
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function limparEReregistrar() {
    setActionLoading("clean");
    setErro(null);
    setResultado(null);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Sessão inválida. Faça login novamente.");

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const subscription = await registration.pushManager.getSubscription().catch(() => null);
          if (subscription) await subscription.unsubscribe().catch(() => undefined);
          const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? "";
          if (script && !script.endsWith("/sw.js")) {
            await registration.unregister().catch(() => undefined);
          }
        }
      }

      await fetch("/api/push/diag", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Permissão negada nas notificações do aparelho.");
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Chave VAPID pública ausente no build.");

      const registration = await getReadyPushRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as Uint8Array<ArrayBuffer>,
      });
      const subscriptionJson = subscription.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh ?? "",
          auth: subscriptionJson.keys?.auth ?? "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar subscription no servidor.");

      setResultado({ ok: true, msg: "Aparelho limpo e registrado de novo. Agora toque em Enviar teste." });
      await verificar();
    } catch (e) {
      setResultado({ ok: false, msg: String(e).replace("Error: ", "") });
    } finally {
      setActionLoading(null);
    }
  }

  async function enviarTesteReal() {
    setActionLoading("test");
    setErro(null);
    setResultado(null);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Sessão inválida. Faça login novamente.");
      const res = await fetch("/api/push/diag", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const delivery = json.delivery as { attempted?: number; sent?: number; failed?: number; removed?: number; errors?: Array<{ status?: number | string; message?: string }> } | undefined;
      const attempted = delivery?.attempted ?? 0;
      const sent = delivery?.sent ?? 0;
      const failed = delivery?.failed ?? 0;
      const removed = delivery?.removed ?? 0;
      const sampleError = delivery?.errors?.[0];

      if (sent > 0) {
        setResultado({ ok: true, msg: `Servidor aceitou o push: ${sent}/${attempted} entregue(s). Se não apareceu na tela, o bloqueio é do iOS/Android.` });
      } else {
        const errorText = sampleError ? ` Erro: ${sampleError.status ?? "?"} ${sampleError.message ?? ""}` : "";
        setResultado({ ok: false, msg: `Servidor não conseguiu entregar: ${sent}/${attempted}. Falhas: ${failed}, removidas: ${removed}.${errorText}` });
      }
    } catch (e) {
      setResultado({ ok: false, msg: String(e).replace("Error: ", "") });
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    verificar();
  }, [user]);

  if (!status) return null;

  const problemas = [];
  if (!status.next_public_vapid_key_set) problemas.push("Chave VAPID pública não configurada");
  if (!status.vapid_private_key_set) problemas.push("Chave VAPID privada não configurada");
  if (!status.autenticado) problemas.push("Não autenticado");
  if (status.suas_subscriptions_count === 0) problemas.push("Nenhuma subscription registrada para este usuário");
  if (device?.permission !== "granted") problemas.push("Permissão de notificação não está concedida neste aparelho");
  if (!device?.hasSubscription) problemas.push("Este aparelho atual não tem subscription ativa");
  if (!device?.swScript?.endsWith("/sw.js")) problemas.push("Este aparelho não está usando o service worker /sw.js");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Diagnóstico de Push</h2>
        <button
          onClick={verificar}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {loading ? "Carregando..." : "Recarregar"}
        </button>
      </div>

      {erro && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {/* Configuração */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Configuração</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            {status.next_public_vapid_key_set ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>Chave VAPID Pública: {status.next_public_vapid_key_set ? "✓ Configurada" : "✗ Ausente"}</span>
          </div>
          <div className="flex items-center gap-2">
            {status.vapid_private_key_set ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>Chave VAPID Privada: {status.vapid_private_key_set ? "✓ Configurada" : "✗ Ausente"}</span>
          </div>
          <div className="flex items-center gap-2">
            {status.service_role_key_set ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>Service Role Key: {status.service_role_key_set ? "✓ Configurada" : "✗ Ausente"}</span>
          </div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subscriptions</p>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            {status.autenticado ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>Autenticado: {status.autenticado ? "✓ Sim" : "✗ Não"}</span>
          </div>
          {status.autenticado && (
            <>
              <p className="text-gray-600">Suas subscriptions: <span className="font-bold">{status.suas_subscriptions_count}</span></p>
              {status.suas_subscriptions.length > 0 && (
                <ul className="ml-4 space-y-1 text-xs text-gray-500">
                  {status.suas_subscriptions.map((sub) => (
                    <li key={sub.id}>
                      <strong>ID:</strong> {sub.id.slice(0, 8)}...
                      <br />
                      <strong>Criado:</strong> {new Date(sub.criado_em).toLocaleString("pt-BR")}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-gray-600">Total no sistema: <span className="font-bold">{status.total_subscriptions_sistema}</span></p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Este aparelho</p>
        <div className="text-sm space-y-1">
          <p className="text-gray-600">Permissão: <span className="font-bold">{device?.permission ?? "verificando"}</span></p>
          <p className="text-gray-600">PWA instalado: <span className="font-bold">{device?.standalone ? "sim" : "não"}</span></p>
          <p className="text-gray-600 break-all">Service worker: <span className="font-bold">{device?.swScript ?? "ausente"}</span></p>
          <p className="text-gray-600">Subscription atual: <span className="font-bold">{device?.hasSubscription ? `${device.endpointHost} ...${device.endpointTail}` : "ausente"}</span></p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          onClick={limparEReregistrar}
          disabled={actionLoading !== null}
          className="flex items-center justify-center gap-2 rounded-xl bg-vine-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-vine-800 disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" />
          {actionLoading === "clean" ? "Limpando..." : "Limpar e re-registrar"}
        </button>
        <button
          onClick={enviarTesteReal}
          disabled={actionLoading !== null}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {actionLoading === "test" ? "Enviando..." : "Enviar teste real"}
        </button>
      </div>

      {resultado && (
        <div className={`rounded-lg border p-4 text-sm ${resultado.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {resultado.msg}
        </div>
      )}

      {/* Problemas */}
      {problemas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-900">Problemas encontrados:</p>
              <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                {problemas.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {problemas.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 items-start">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-green-900">Configuração OK.</p>
            <p className="text-green-800">Agora use o botão “Enviar teste real” para confirmar entrega no aparelho.</p>
          </div>
        </div>
      )}
    </div>
  );
}
