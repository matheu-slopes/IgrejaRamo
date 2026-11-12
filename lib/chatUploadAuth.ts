import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isChatMember } from "@/lib/chatServerAuth";
import { acessoMinisterio } from "@/lib/ministerioAcesso";

type Resultado = { ok: true; caminho: string } | { ok: false; status: number; erro: string };

/** Valida conversas comuns e canais de ministério sem confiar no destino enviado pelo cliente. */
export async function autorizarUploadChat(admin: SupabaseClient, destino: string, usuarioId: string): Promise<Resultado> {
  if (destino.startsWith("ministerio_")) {
    const ministerio = destino.slice("ministerio_".length);
    if (!ministerio || ministerio.length > 150) return { ok: false, status: 400, erro: "Ministério inválido." };
    try {
      const acesso = await acessoMinisterio(admin, usuarioId, ministerio);
      if (!acesso.membro) return { ok: false, status: 403, erro: "Você não participa deste ministério." };
      const { data: canal, error } = await admin.from("canais_ministerio").select("chat_bloqueado").eq("ministerio", ministerio).maybeSingle();
      if (error || !canal) return { ok: false, status: 503, erro: "Não foi possível verificar o chat do ministério." };
      if (canal.chat_bloqueado && !acesso.lider) return { ok: false, status: 403, erro: "O chat está fechado para mensagens." };
      const identificador = createHash("sha256").update(ministerio, "utf8").digest("hex");
      return { ok: true, caminho: `ministerios/${identificador}` };
    } catch {
      return { ok: false, status: 503, erro: "Não foi possível verificar seu acesso ao ministério." };
    }
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(destino)) {
    return { ok: false, status: 400, erro: "Conversa inválida." };
  }
  if (!await isChatMember(admin, destino, usuarioId)) return { ok: false, status: 403, erro: "Você não participa desta conversa." };
  return { ok: true, caminho: destino };
}
