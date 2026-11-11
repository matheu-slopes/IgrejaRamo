import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import type { EquipeMembro } from "@/lib/equipesMinisterio";

export async function GET(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const ministerio = req.nextUrl.searchParams.get("ministerio");
  if (!ministerio) return NextResponse.json({ error: "Informe o ministério." }, { status: 400 });
  const { data, error } = await auth.admin.from("equipes_ministerio").select("id, ministerio, nome, membros").eq("ministerio", ministerio).order("criado_em");
  if (error) return NextResponse.json({ error: "Não foi possível carregar as equipes. Verifique a configuração do banco." }, { status: 500 });
  return NextResponse.json({ equipes: data });
}

export async function POST(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  let body: { id?: string; ministerio?: string; nome?: string; membros?: EquipeMembro[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const { id, ministerio } = body;
  if (!ministerio || typeof ministerio !== "string") return NextResponse.json({ error: "Informe o ministério." }, { status: 400 });
  if (!auth.permissions.includes("gerenciar_membros_ministerio") && !auth.perfil.lider_ministerios?.includes(ministerio)) return forbidden();
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!nome || nome.length > 80 || /[\]\r\n]/.test(nome) || !Array.isArray(body.membros) || body.membros.length > 100) return NextResponse.json({ error: "Informe um nome válido, sem quebras de linha ou ], e uma lista válida de membros." }, { status: 400 });
  const membros = body.membros;
  if (membros.some((m) => !m || typeof m.usuarioId !== "string" || typeof m.funcao !== "string" || !m.funcao.trim() || m.funcao.length > 80) || new Set(membros.map((m) => m.usuarioId)).size !== membros.length) {
    return NextResponse.json({ error: "Revise os membros e suas funções." }, { status: 400 });
  }
  if (membros.length) {
    const { data, error } = await auth.admin.from("perfis").select("id").in("id", membros.map((m) => m.usuarioId)).contains("ministerios", [ministerio]).eq("ativo", true);
    if (error || data?.length !== membros.length) return NextResponse.json({ error: "Selecione apenas membros ativos deste ministério." }, { status: 400 });
  }
  const valores = { nome, membros: membros.map((m) => ({ usuarioId: m.usuarioId, funcao: m.funcao.trim() })) };
  const query = id
    ? auth.admin.from("equipes_ministerio").update(valores).eq("id", id).eq("ministerio", ministerio)
    : auth.admin.from("equipes_ministerio").insert({ ...valores, ministerio });
  const { data, error } = await query.select("id, ministerio, nome, membros").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe uma equipe com esse nome." : "Não foi possível salvar a equipe." }, { status: 400 });
  return NextResponse.json({ equipe: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  let body: { id?: string; ministerio?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!body.id || !body.ministerio) return NextResponse.json({ error: "Informe a equipe e o ministério." }, { status: 400 });
  if (!auth.permissions.includes("gerenciar_membros_ministerio") && !auth.perfil.lider_ministerios?.includes(body.ministerio)) return forbidden();
  const { error } = await auth.admin.from("equipes_ministerio").delete().eq("id", body.id).eq("ministerio", body.ministerio);
  if (error) return NextResponse.json({ error: "Não foi possível excluir a equipe." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
