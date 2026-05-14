import { supabase } from "@/lib/supabase";

type BroadcastOpts = {
  tipo: "aviso" | "evento";
  titulo: string;
  conteudo?: string;
  ministerio?: string;
};

/**
 * Chama /api/push/broadcast após publicar um aviso ou evento.
 * Aguarda o envio para garantir que não seja abortado em ambiente serverless.
 */
export async function notificarBroadcast(opts: BroadcastOpts): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn("notificarBroadcast: sem sessão para enviar push");
      return;
    }

    const res = await fetch("/api/push/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(opts),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.warn("notificarBroadcast:", res.status, json.error ?? res.statusText);
    }
  } catch (e) {
    console.error("notificarBroadcast error:", e);
  }
}
