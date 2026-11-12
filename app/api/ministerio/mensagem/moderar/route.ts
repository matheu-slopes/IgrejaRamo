import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import { acessoMinisterio } from "@/lib/ministerioAcesso";

export async function PATCH(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || typeof body.fixada !== "boolean") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { data: msg, error } = await auth.admin.from("mural_mensagens").select("ministerio").eq("id", body.id).maybeSingle();
  if (error || !msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  try {
    const acesso = await acessoMinisterio(auth.admin, auth.user.id, msg.ministerio);
    if (!acesso.lider) return forbidden();
    const { error: updateError } = await auth.admin.from("mural_mensagens").update({ fixada: body.fixada }).eq("id", body.id);
    if (updateError) return NextResponse.json({ error: "Não foi possível fixar a mensagem." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Não foi possível verificar a liderança." }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { data: msg, error } = await auth.admin.from("mural_mensagens").select("ministerio,autor_id").eq("id", body.id).maybeSingle();
  if (error || !msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  try {
    const acesso = await acessoMinisterio(auth.admin, auth.user.id, msg.ministerio);
    if (!acesso.membro || (msg.autor_id !== auth.user.id && !acesso.lider)) return forbidden();
    const { error: deleteError } = await auth.admin.from("mural_mensagens").delete().eq("id", body.id);
    if (deleteError) return NextResponse.json({ error: "Não foi possível excluir a mensagem." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Não foi possível verificar o acesso." }, { status: 500 }); }
}
