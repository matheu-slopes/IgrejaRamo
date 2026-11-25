import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarArquivoMidia } from "@/lib/validarArquivoMidia";
import { CotaMidiasError, finalizarReservaMidia, reservarMidia } from "@/lib/cotaMidiasR2";
import { salvarMidiaPrivada } from "@/lib/armazenamentoMidiasR2";

export async function salvarFotoPerfil(admin: SupabaseClient, usuarioId: string, foto: unknown): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(usuarioId)) throw new CotaMidiasError("Perfil inválido.", 400);
  if (typeof foto !== "string" || foto.length > 6_000_000) throw new CotaMidiasError("Foto inválida ou muito grande.", 400);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(foto);
  if (!match) throw new CotaMidiasError("Formato de foto não suportado.", 400);
  const bytes = Buffer.from(match[2], "base64");
  const validada = validarArquivoMidia(match[1], bytes);
  if (!validada) throw new CotaMidiasError("Foto inválida ou muito grande.", 400);
  const id = randomUUID();
  const chave = `perfis/${usuarioId.toLowerCase()}/${id}.${validada.extensao}`;
  await reservarMidia(admin, id, bytes.byteLength);
  try { await salvarMidiaPrivada(chave, bytes, match[1]); }
  catch { throw new CotaMidiasError("Não foi possível salvar a foto.", 503); }
  finally { await finalizarReservaMidia(admin, id); }
  return `r2midia:${chave}`;
}
