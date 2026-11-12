import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import type { EquipeMembro } from "@/lib/equipesMinisterio";

export async function GET(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  if (!auth.permissions.includes("gerenciar_usuarios")) return forbidden();
  const usuarioId = req.nextUrl.searchParams.get("usuarioId");
  if (!usuarioId) return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
  const { data, error } = await auth.admin.from("equipes_ministerio").select("id,ministerio,nome,membros").contains("membros", [{ usuarioId }]).order("ministerio").order("criado_em");
  if (error) return NextResponse.json({ error: "Não foi possível carregar as equipes." }, { status: 500 });
  const equipes = (data ?? []).flatMap((e) => (e.membros as EquipeMembro[]).filter((m) => m.usuarioId === usuarioId).map((m) => ({ id: e.id, ministerio: e.ministerio, nome: e.nome, funcao: m.funcao })));
  return NextResponse.json({ equipes });
}

export async function PATCH(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  if (!auth.permissions.includes("gerenciar_usuarios")) return forbidden();
  let body: { equipeId?: string; usuarioId?: string; funcao?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (typeof body.equipeId !== "string" || typeof body.usuarioId !== "string" || typeof body.funcao !== "string" || !body.funcao.trim() || body.funcao.length > 80) return NextResponse.json({ error: "Informe a equipe, o usuário e a função." }, { status: 400 });
  const { error } = await auth.admin.rpc("alterar_funcao_integrante_equipe", { p_equipe: body.equipeId, p_usuario: body.usuarioId, p_funcao: body.funcao });
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a função. Recarregue a lista e tente novamente." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
