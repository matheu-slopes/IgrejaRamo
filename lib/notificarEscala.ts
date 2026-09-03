import { supabase } from "@/lib/supabase";

export type AcaoNotificacaoEscala = "alterada" | "cobrar_pendentes" | "aviso_geral";

type NotificarEscalaResult = {
  ok: boolean;
  destinatarios?: number;
  notificacoesInApp?: number;
  delivery?: { attempted: number; sent: number; failed: number; removed: number };
  error?: string;
};

async function accessToken(forceRefresh = false) {
  const { data: { session } } = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  return session?.access_token ?? "";
}

/** Dispara uma notificacao de escala pela API protegida do servidor. */
export async function notificarEscala(
  escalaId: string,
  acao: AcaoNotificacaoEscala,
  mensagem?: string,
): Promise<NotificarEscalaResult> {
  let token = await accessToken();
  if (!token) return { ok: false, error: "Sessao expirada. Entre novamente." };

  const request = (bearer: string) => fetch("/api/push/escalas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ escalaId, acao, mensagem }),
  });

  let response = await request(token);
  if (response.status === 401) {
    token = await accessToken(true);
    if (token) response = await request(token);
  }

  const result = await response.json().catch(() => ({})) as NotificarEscalaResult;
  if (!response.ok || !result.ok) {
    return { ...result, ok: false, error: result.error ?? `Falha no envio (${response.status}).` };
  }
  return result;
}
