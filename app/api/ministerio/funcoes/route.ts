import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import { temPermissaoMinisterio } from "@/lib/ministerioAcesso";

export async function GET(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const ministerio = req.nextUrl.searchParams.get("ministerio");
  if (!ministerio) return NextResponse.json({ error: "Informe o ministério." }, { status: 400 });
  const { data, error } = await auth.admin.from("funcoes_ministerio").select("id,nome").eq("ministerio", ministerio).eq("ativo", true).order("criado_em");
  if (error) return NextResponse.json({ error: "Não foi possível carregar as funções." }, { status: 500 });
  return NextResponse.json({ funcoes: data });
}

export async function POST(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  let body: { id?: string; ministerio?: string; nome?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!body.ministerio || typeof body.ministerio !== "string") return NextResponse.json({ error: "Informe o ministério." }, { status: 400 });
  try { if (!await temPermissaoMinisterio(auth.admin, auth.user.id, body.ministerio, "gerenciar_membros_ministerio")) return forbidden(); }
  catch { return NextResponse.json({ error: "Não foi possível verificar a permissão." }, { status: 500 }); }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!nome || nome.length > 80 || /[\r\n]/.test(nome)) return NextResponse.json({ error: "Informe um nome válido para a função." }, { status: 400 });
  const query = body.id
    ? auth.admin.from("funcoes_ministerio").update({ nome }).eq("id", body.id).eq("ministerio", body.ministerio).eq("ativo", true)
    : auth.admin.from("funcoes_ministerio").upsert({ ministerio: body.ministerio, nome, ativo: true }, { onConflict: "ministerio,nome" });
  const { data, error } = await query.select("id,nome").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe uma função com esse nome." : "Não foi possível salvar a função." }, { status: 400 });
  return NextResponse.json({ funcao: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  let body: { id?: string; ministerio?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!body.id || !body.ministerio) return NextResponse.json({ error: "Informe a função e o ministério." }, { status: 400 });
  try { if (!await temPermissaoMinisterio(auth.admin, auth.user.id, body.ministerio, "gerenciar_membros_ministerio")) return forbidden(); }
  catch { return NextResponse.json({ error: "Não foi possível verificar a permissão." }, { status: 500 }); }
  const { error } = await auth.admin.from("funcoes_ministerio").update({ ativo: false }).eq("id", body.id).eq("ministerio", body.ministerio);
  if (error) return NextResponse.json({ error: "Não foi possível remover a função." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
