"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

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

export function DiagnosticoPush() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusPush | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function verificar() {
    setLoading(true);
    setErro(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErro("Não autenticado");
        return;
      }

      const res = await fetch("/api/push/status", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json: StatusPush = await res.json();
      setStatus(json);

      if (!res.ok) {
        setErro(json.erro_auth ?? "Erro ao obter status");
      }
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
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
            <p className="font-semibold text-green-900">Tudo OK!</p>
            <p className="text-green-800">Seu sistema de push está configurado e pronto para receber notificações.</p>
          </div>
        </div>
      )}
    </div>
  );
}
