import { supabase } from "@/lib/supabase";

type BroadcastOpts = {
  tipo: "aviso" | "evento";
  titulo: string;
  conteudo?: string;
  ministerio?: string;
};

type BroadcastDelivery = {
  attempted: number;
  sent: number;
  failed: number;
  removed: number;
  errors: Array<{ status: number | "unknown"; message: string }>;
};

type BroadcastResult = {
  ok: boolean;
  delivery?: BroadcastDelivery;
  error?: string;
};

/**
 * Chama /api/push/broadcast após publicar um aviso ou evento.
 * Aguarda o envio para garantir que não seja abortado em ambiente serverless.
 */
export async function notificarBroadcast(opts: BroadcastOpts): Promise<BroadcastResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn("notificarBroadcast: sem sessão para enviar push");
      return { ok: false, error: "Sem sessão" };
    }

    let token = session.access_token;
    const expiresAt = session.expires_at ?? 0;
    if (Date.now() / 1000 > expiresAt - 60) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token ?? "";
      if (!token) {
        console.warn("notificarBroadcast: falha ao renovar sessão");
        return { ok: false, error: "Falha ao renovar sessão" };
      }
    }

    const res = await fetch("/api/push/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(opts),
    });

    const json = await res.json().catch(() => ({})) as BroadcastResult;

    if (!res.ok) {
      console.warn("notificarBroadcast:", res.status, json.error ?? res.statusText);
      return { ok: false, error: json.error ?? res.statusText };
    }

    if (!json.ok) {
      console.warn("notificarBroadcast delivery warning:", json.error ?? "sem detalhes");
    }

    return json;
  } catch (e) {
    console.error("notificarBroadcast error:", e);
    return { ok: false, error: String(e) };
  }
}
