"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Bell, RefreshCw, Trash2, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type ServerDiag = {
  vapid: {
    server_set: boolean;
    client_set: boolean;
    private_set: boolean;
    server_fingerprint: string | null;
    client_fingerprint: string | null;
    match: boolean;
  };
  service_role_set: boolean;
  autenticado: boolean;
  user_id?: string;
  minhas_subs_count?: number;
  minhas_subs?: { host: string; criado_em: string; endpoint_tail: string }[];
};

type ClientDiag = {
  display_mode: string;
  notification_permission: string;
  has_service_worker: boolean;
  has_push_manager: boolean;
  sw_script_url: string | null;
  sw_scope: string | null;
  sw_state: string | null;
  current_endpoint_host: string | null;
  current_endpoint_tail: string | null;
  has_subscription: boolean;
  client_vapid_fingerprint: string | null;
  user_agent: string;
};

function fpClient(value: string | undefined | null) {
  if (!value) return null;
  return value.length < 10 ? value : `${value.slice(0, 6)}…${value.slice(-6)} (len ${value.length})`;
}

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushDiagPage() {
  const { user } = useAuth();
  const [server, setServer] = useState<ServerDiag | null>(null);
  const [client, setClient] = useState<ClientDiag | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<unknown>(null);

  async function coletarClient(): Promise<ClientDiag> {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
    let scriptUrl: string | null = null;
    let scope: string | null = null;
    let state: string | null = null;
    let endpointHost: string | null = null;
    let endpointTail: string | null = null;
    let hasSub = false;

    const hasSW = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const hasPM = typeof window !== "undefined" && "PushManager" in window;

    if (hasSW) {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg) {
          scriptUrl = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? null;
          scope = reg.scope;
          state = reg.active?.state ?? reg.installing?.state ?? reg.waiting?.state ?? null;
          if (hasPM) {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              hasSub = true;
              try {
                const u = new URL(sub.endpoint);
                endpointHost = u.host;
              } catch { /* ignore */ }
              endpointTail = sub.endpoint.slice(-12);
            }
          }
        }
      } catch { /* ignore */ }
    }

    let displayMode = "browser";
    if (typeof window !== "undefined") {
      if (window.matchMedia?.("(display-mode: standalone)").matches) displayMode = "standalone";
      // iOS legacy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else if ((window.navigator as any).standalone === true) displayMode = "ios-standalone";
    }

    return {
      display_mode: displayMode,
      notification_permission:
        typeof Notification !== "undefined" ? Notification.permission : "indisponivel",
      has_service_worker: hasSW,
      has_push_manager: hasPM,
      sw_script_url: scriptUrl,
      sw_scope: scope,
      sw_state: state,
      current_endpoint_host: endpointHost,
      current_endpoint_tail: endpointTail,
      has_subscription: hasSub,
      client_vapid_fingerprint: fpClient(vapidKey ?? undefined),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };
  }

  async function carregar() {
    setLoading(true);
    setActionMsg(null);
    setActionErr(null);
    try {
      const c = await coletarClient();
      setClient(c);
      const token = await getToken();
      const res = await fetch("/api/push/diag", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json();
      setServer(json);
    } catch (e) {
      setActionErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  async function limparEReregistrar() {
    setLoading(true);
    setActionMsg(null);
    setActionErr(null);
    setTestResult(null);
    try {
      // 1. Desregistra todos os SW
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try {
            const sub = await r.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch { /* ignore */ }
          await r.unregister();
        }
      }

      // 2. Limpa subs no servidor
      const token = await getToken();
      if (!token) throw new Error("Sessão inválida — faça login novamente.");
      await fetch("/api/push/diag", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      // 3. Pede permissão e re-registra
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("Permissão negada pelo SO. Vá em Ajustes → Notificações.");
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("VAPID público ausente no build.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as Uint8Array<ArrayBuffer>,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao registrar no servidor.");

      setActionMsg("✓ Limpo e re-registrado. Agora teste o envio abaixo.");
      await carregar();
    } catch (e) {
      setActionErr(String(e).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  }

  async function enviarTeste() {
    setLoading(true);
    setTestResult(null);
    setActionErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão inválida.");
      const res = await fetch("/api/push/diag", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setTestResult(j);
      if (!res.ok) throw new Error(j.error ?? "Falha ao enviar teste.");
    } catch (e) {
      setActionErr(String(e).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  }

  const vapidOk = server?.vapid.match === true;
  const swOk = !!client?.sw_script_url && client.sw_script_url.endsWith("/sw.js");
  const subOk = !!client?.has_subscription;
  const permOk = client?.notification_permission === "granted";
  const standaloneOk = client?.display_mode === "standalone" || client?.display_mode === "ios-standalone";
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-vine-700" />
        <h1 className="text-xl font-bold">Diagnóstico de Notificações</h1>
        <button
          onClick={carregar}
          disabled={loading}
          className="ml-auto p-2 rounded-full hover:bg-vine-100"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="grid gap-2">
        <Check label="Permissão do SO" ok={permOk} value={client?.notification_permission ?? "?"} />
        <Check label="Service Worker ativo (/sw.js)" ok={swOk} value={client?.sw_script_url ?? "ausente"} />
        <Check label="Inscrição push (browser)" ok={subOk} value={subOk ? `${client?.current_endpoint_host} …${client?.current_endpoint_tail}` : "sem subscription"} />
        <Check label="Inscrições salvas no servidor" ok={(server?.minhas_subs_count ?? 0) > 0} value={`${server?.minhas_subs_count ?? 0} sub(s)`} />
        <Check label="VAPID cliente = servidor" ok={vapidOk} value={vapidOk ? "iguais" : `cli=${server?.vapid.client_fingerprint} / srv=${server?.vapid.server_fingerprint}`} />
        <Check label="PWA instalado (standalone)" ok={standaloneOk} value={client?.display_mode ?? "?"} warning={isIOS && !standaloneOk ? "iOS exige PWA instalado pra push" : null} />
      </div>

      {actionMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
          {actionMsg}
        </div>
      )}
      {actionErr && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {actionErr}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={limparEReregistrar}
          disabled={loading}
          className="bg-vine-700 hover:bg-vine-800 text-white font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" /> Limpar tudo e re-registrar este aparelho
        </button>
        <button
          onClick={enviarTeste}
          disabled={loading || !subOk}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Send className="w-4 h-4" /> Enviar push de teste pra mim
        </button>
      </div>

      {!!testResult && (
        <details open className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <summary className="font-semibold text-sm mb-2">Resultado do teste</summary>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(testResult, null, 2)}</pre>
        </details>
      )}

      <details className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
        <summary className="font-semibold text-sm">Detalhes técnicos</summary>
        <div className="mt-2 space-y-2">
          <div>
            <strong>Cliente:</strong>
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(client, null, 2)}</pre>
          </div>
          <div>
            <strong>Servidor:</strong>
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(server, null, 2)}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function Check({ label, ok, value, warning }: { label: string; ok: boolean; value: string; warning?: string | null }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl border bg-white">
      {ok ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-gray-600 break-all">{value}</div>
        {warning && (
          <div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3" /> {warning}
          </div>
        )}
      </div>
    </div>
  );
}
