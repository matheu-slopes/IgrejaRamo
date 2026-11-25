import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { acessoMinisterio } from "@/lib/ministerioAcesso";

const PREFIXO = "r2midia:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Resultado = { ok: true; chave: string } | { ok: false; status: number; erro: string };

export function prefixoDaConversa(tipo: "conversa" | "ministerio", destino: string): string {
  const identidade = tipo === "conversa" ? destino.toLowerCase() : destino;
  const hash = createHash("sha256").update(`${tipo}:${identidade}`, "utf8").digest("hex");
  return `chat/${hash}/`;
}

/** Resolve apenas referências persistidas em mensagens que o usuário pode consultar. */
export async function autorizarMidiaDeMensagem(admin: SupabaseClient, userId: string, tipo: string, mensagemId: string): Promise<Resultado> {
  if (!UUID.test(mensagemId) || (tipo !== "conversa" && tipo !== "ministerio")) return { ok: false, status: 400, erro: "Mensagem inválida." };
  const { data, error } = tipo === "conversa"
    ? await admin.from("chat_mensagens").select("conversa_id,criado_em,media_url").eq("id", mensagemId).maybeSingle()
    : await admin.from("mural_mensagens").select("ministerio,media_url").eq("id", mensagemId).maybeSingle();
  const mensagem = data as { media_url?: unknown; conversa_id?: unknown; criado_em?: string | null; ministerio?: unknown } | null;
  if (error) return { ok: false, status: 503, erro: "Não foi possível verificar a mídia." };
  if (!mensagem || typeof mensagem.media_url !== "string" || !mensagem.media_url.startsWith(PREFIXO)) return { ok: false, status: 404, erro: "Mídia não encontrada." };

  let destino: string;
  if (tipo === "conversa") {
    const conversaId = mensagem.conversa_id;
    if (typeof conversaId !== "string") return { ok: false, status: 403, erro: "Acesso negado." };
    destino = conversaId;
    const { data: participante, error: acessoErro } = await admin.from("chat_participantes")
      .select("historico_desde,ocultado_em").eq("conversa_id", conversaId).eq("user_id", userId).maybeSingle();
    if (acessoErro) return { ok: false, status: 503, erro: "Não foi possível verificar a conversa." };
    if (!participante) return { ok: false, status: 403, erro: "Acesso negado." };
    const limites = [participante.historico_desde, participante.ocultado_em].filter(Boolean).map((d: string) => Date.parse(d));
    const criada = mensagem.criado_em ? Date.parse(mensagem.criado_em) : NaN;
    if (limites.some((n: number) => !Number.isFinite(n)) || (limites.length > 0 && (!Number.isFinite(criada) || criada < Math.max(...limites)))) {
      return { ok: false, status: 403, erro: "Acesso negado." };
    }
  } else {
    if (typeof mensagem.ministerio !== "string") return { ok: false, status: 403, erro: "Acesso negado." };
    destino = mensagem.ministerio;
    try {
      const acesso = await acessoMinisterio(admin, userId, mensagem.ministerio);
      if (!acesso.membro) return { ok: false, status: 403, erro: "Acesso negado." };
    } catch { return { ok: false, status: 503, erro: "Não foi possível verificar o ministério." }; }
  }

  const chave = mensagem.media_url.slice(PREFIXO.length);
  if (!chave.startsWith(prefixoDaConversa(tipo, destino))) return { ok: false, status: 403, erro: "Acesso negado." };
  return { ok: true, chave };
}
