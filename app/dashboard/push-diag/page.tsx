"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, RefreshCw, Send, Trash2 } from "lucide-react";

type DiagResponse = {
  vapid?: {
    server_set?: boolean;
    client_set?: boolean;
    runtime_public_key_set?: boolean;
    private_set?: boolean;
    subject?: string;
    match?: boolean;
  };
  autenticado?: boolean;
  minhas_subs_count?: number;
  minhas_subs?: Array<{ host: string; criado_em: string; endpoint_tail: string }>;
  fila?: unknown;
  delivery?: {
    attempted: number;
    sent: number;
    failed: number;
    removed: number;
    errors: Array<{ status: number | "unknown"; message: string; endpointHost?: string }>;
  };
  ok?: boolean;
  error?: string;
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

export default function PushDiagPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function callDiag(method: "GET" | "POST" | "DELETE") {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessao expirada");

      const res = await fetch("/api/push/diag", {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? res.statusText);

      if (method === "DELETE") {
        setMessage("Registro removido. Volte ao dashboard para o PWA registrar novamente.");
        await callDiag("GET");
        return;
      }

      setResult(json);
      if (method === "POST") {
        setMessage(json.ok ? "Push de teste enviado." : "Push de teste nao foi entregue.");
      }
    } catch (e) {
      setMessage(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    callDiag("GET");
  }, []);

  const delivery = result?.delivery;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Sistema</p>
            <h1 className="text-xl font-bold text-gray-900">Diagnostico Push</h1>
          </div>
          <div className="h-11 w-11 rounded-xl bg-vine-900 text-white flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => callDiag("GET")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Status
          </button>
          <button
            onClick={() => callDiag("POST")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-vine-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Testar
          </button>
          <button
            onClick={() => callDiag("DELETE")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-white border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Limpar
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700">
            {message}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Configuracao</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Status label="VAPID publica" ok={result?.vapid?.runtime_public_key_set} />
            <Status label="VAPID privada" ok={result?.vapid?.private_set} />
            <Status label="Autenticado" ok={result?.autenticado} />
            <Status label="Chaves batem" ok={result?.vapid?.match} />
          </div>
          {result?.vapid?.subject && (
            <p className="break-words rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Subject: {result.vapid.subject}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Este aparelho</h2>
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
            <span className="text-sm text-gray-600">Subscriptions</span>
            <span className="text-sm font-bold text-gray-900">{result?.minhas_subs_count ?? 0}</span>
          </div>
          <div className="space-y-2">
            {(result?.minhas_subs ?? []).map((sub) => (
              <div key={`${sub.host}-${sub.endpoint_tail}`} className="rounded-md border border-gray-100 px-3 py-2 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">{sub.host}</p>
                <p>{new Date(sub.criado_em).toLocaleString("pt-BR")}</p>
                <p className="text-gray-400">...{sub.endpoint_tail}</p>
              </div>
            ))}
          </div>
        </section>

        {delivery && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Ultimo teste</h2>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <Metric label="Tentou" value={delivery.attempted} />
              <Metric label="Enviou" value={delivery.sent} />
              <Metric label="Falhou" value={delivery.failed} />
              <Metric label="Removeu" value={delivery.removed} />
            </div>
            {delivery.errors?.map((err, index) => (
              <div key={index} className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                <p className="font-bold">{err.status} {err.endpointHost ?? ""}</p>
                <p className="break-words">{err.message}</p>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Fila</h2>
          <pre className="max-h-64 overflow-auto rounded-md bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-100">
            {JSON.stringify(result?.fila ?? null, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

function Status({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
      <span className="text-gray-600">{label}</span>
      <span className={ok ? "font-bold text-green-700" : "font-bold text-red-700"}>{ok ? "OK" : "Nao"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}