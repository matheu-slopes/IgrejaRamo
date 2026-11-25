import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { securityAuth } from "@/lib/securityAuth";
import { autorizarUploadChat } from "@/lib/chatUploadAuth";
import { chatWriteAccess } from "@/lib/chatServerAuth";
import { prefixoDaConversa } from "@/lib/midiaDeMensagem";
import { validarArquivoMidia } from "@/lib/validarArquivoMidia";
import { CotaMidiasError, finalizarReservaMidia, MAX_ARQUIVO_MIDIA_BYTES, reservarMidia } from "@/lib/cotaMidiasR2";
import { salvarMidiaPrivada } from "@/lib/armazenamentoMidiasR2";

/** Upload via servidor: nenhum URL de escrita é fornecido ao navegador. */
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS !== "true") return NextResponse.json({ error: "Envio de mídias ainda não está ativo." }, { status: 404 });
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_ARQUIVO_MIDIA_BYTES + 128 * 1024) {
    return NextResponse.json({ error: "O arquivo deve ter no máximo 4 MB." }, { status: 413 });
  }
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 }); }
  const file = form.get("file");
  const destino = form.get("conversa_id");
  const mensagemId = form.get("mensagem_id");
  if (!(file instanceof File) || typeof destino !== "string" || !destino || typeof mensagemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mensagemId)) return NextResponse.json({ error: "Arquivo, mensagem e conversa são obrigatórios." }, { status: 400 });
  if (!file.size || file.size > MAX_ARQUIVO_MIDIA_BYTES) return NextResponse.json({ error: "O arquivo deve ter no máximo 4 MB." }, { status: 413 });
  const acesso = await autorizarUploadChat(auth.admin, destino, auth.user.id);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.status });
  if (!destino.startsWith("ministerio_")) {
    const escrita = await chatWriteAccess(auth.admin, destino, auth.user.id);
    if (!escrita.allowed) return NextResponse.json({ error: escrita.reason ?? "Acesso negado." }, { status: 403 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validado = validarArquivoMidia(file.type, bytes);
  if (!validado) return NextResponse.json({ error: "Tipo de arquivo não suportado ou conteúdo inválido." }, { status: 400 });

  const tipo = destino.startsWith("ministerio_") ? "ministerio" : "conversa";
  const contexto = tipo === "ministerio" ? destino.slice("ministerio_".length) : destino;
  const id = randomUUID();
  // Repetições do mesmo envio usam a mesma chave, sem criar cópias extras.
  const hash = createHash("sha256").update(bytes).digest("hex");
  const chave = `${prefixoDaConversa(tipo, contexto)}${auth.user.id.toLowerCase()}/${mensagemId.toLowerCase()}-${hash}.${validado.extensao}`;
  try {
    await reservarMidia(auth.admin, id, bytes.byteLength);
  } catch (error) {
    const cota = error instanceof CotaMidiasError ? error : new CotaMidiasError("Não foi possível reservar espaço.", 503);
    return NextResponse.json({ error: cota.message }, { status: cota.status });
  }
  try {
    await salvarMidiaPrivada(chave, bytes, file.type.split(";")[0].trim().toLowerCase());
    return NextResponse.json({ referencia: `r2midia:${chave}` }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar a mídia. Tente novamente." }, { status: 503 });
  } finally {
    await finalizarReservaMidia(auth.admin, id);
  }
}
