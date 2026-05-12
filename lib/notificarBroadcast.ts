import { supabase } from "@/lib/supabase";

type BroadcastOpts = {
  tipo: "aviso" | "evento";
  titulo: string;
  conteudo?: string;
  ministerio?: string;
};

/**
 * Chama /api/push/broadcast após publicar um aviso ou evento.
 * Fire-and-forget — não bloqueia o fluxo principal.
 */
export async function notificarBroadcast(opts: BroadcastOpts): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch("/api/push/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(opts),
    });
  } catch (e) {
    console.error("notificarBroadcast error:", e);
  }
}
