import { NextRequest, NextResponse } from "next/server";
import { securityAuth } from "@/lib/securityAuth";
import { autorizarMidiaDeMensagem, prefixoDaConversa } from "@/lib/midiaDeMensagem";
import { urlTemporariaDeMidia } from "@/lib/armazenamentoMidiasR2";

export async function POST(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null) as { tipo?: unknown; mensagemId?: unknown } | null;
  if (typeof body?.tipo !== "string" || typeof body?.mensagemId !== "string") return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  let chave: string;
  if (body.tipo === "perfil") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.mensagemId)) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    const { data, error } = await auth.admin.from("perfis").select("foto").eq("id", body.mensagemId).maybeSingle();
    if (error) return NextResponse.json({ error: "Não foi possível verificar a foto." }, { status: 503 });
    const prefixo = `r2midia:perfis/${body.mensagemId.toLowerCase()}/`;
    if (typeof data?.foto !== "string" || !data.foto.startsWith(prefixo)) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
    chave = data.foto.slice("r2midia:".length);
  } else if (body.tipo === "grupo") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.mensagemId)) return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
    const [{ data: grupo, error }, { data: membro, error: membroError }] = await Promise.all([
      auth.admin.from("chat_conversas").select("tipo,avatar_url").eq("id", body.mensagemId).maybeSingle(),
      auth.admin.from("chat_participantes").select("user_id").eq("conversa_id", body.mensagemId).eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (error || membroError) return NextResponse.json({ error: "Não foi possível verificar o grupo." }, { status: 503 });
    const prefixo = `r2midia:${prefixoDaConversa("conversa", body.mensagemId)}avatar/`;
    if (!membro || grupo?.tipo !== "grupo" || typeof grupo.avatar_url !== "string" || !grupo.avatar_url.startsWith(prefixo)) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
    chave = grupo.avatar_url.slice("r2midia:".length);
  } else {
    const acesso = await autorizarMidiaDeMensagem(auth.admin, auth.user.id, body.tipo, body.mensagemId);
    if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.status });
    chave = acesso.chave;
  }
  try {
    const url = await urlTemporariaDeMidia(chave);
    return NextResponse.json({ url, validadeSegundos: 300 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir esta mídia agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
