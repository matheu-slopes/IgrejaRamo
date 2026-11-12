import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import { acessoMinisterio, temPermissaoMinisterio } from "@/lib/ministerioAcesso";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// POST /api/ministerio/membro — adicionar membro ao ministério
export async function POST(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const { usuarioId, ministerio, funcao } = await req.json();
  if (!usuarioId || !ministerio || !funcao) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  try {
    if (!await temPermissaoMinisterio(auth.admin, auth.user.id, ministerio, "gerenciar_membros_ministerio")) return forbidden();
    if (["Líder", "Colíder", "Ministro"].includes(funcao) && !(await acessoMinisterio(auth.admin, auth.user.id, ministerio)).lider) return forbidden();
  } catch { return NextResponse.json({ error: "Não foi possível verificar a permissão." }, { status: 500 }); }

  if (!["Líder", "Colíder", "Voluntário(a)", ...(ministerio === "Louvor" ? ["Ministro"] : [])].includes(funcao)) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  const { error } = await auth.admin.rpc("adicionar_membro_ministerio", { p_usuario: usuarioId, p_ministerio: ministerio, p_funcao: funcao });
  if (error) return NextResponse.json({ error: "Não foi possível adicionar o membro." }, { status: 400 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/ministerio/membro — remover membro do ministério
export async function DELETE(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const { usuarioId, ministerio } = await req.json();
  if (!usuarioId || !ministerio) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  try {
    if (!await temPermissaoMinisterio(auth.admin, auth.user.id, ministerio, "gerenciar_membros_ministerio")) return forbidden();
    const alvo = await acessoMinisterio(auth.admin, usuarioId, ministerio);
    const ator = await acessoMinisterio(auth.admin, auth.user.id, ministerio);
    if (alvo.lider && !ator.lider) return forbidden();
  } catch { return NextResponse.json({ error: "Não foi possível verificar a permissão." }, { status: 500 }); }

  const admin = adminClient();

  const { data: perfil, error: perfilError } = await admin
    .from("perfis")
    .select("ministerios, lider_ministerios")
    .eq("id", usuarioId)
    .single();

  if (perfilError || !perfil) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const ministeriosAtuais: string[] = perfil?.ministerios ?? [];

  const { error: updateError } = await admin
    .from("perfis")
    .update({ ministerios: ministeriosAtuais.filter((m) => m !== ministerio), lider_ministerios: (perfil.lider_ministerios ?? []).filter((m: string) => m !== ministerio) })
    .eq("id", usuarioId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: deleteError } = await admin
    .from("membros_ministerio")
    .delete()
    .eq("usuario_id", usuarioId)
    .eq("ministerio", ministerio);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

const DELEGAVEIS = ["criar_escala", "criar_evento", "editar_evento", "gerenciar_membros_ministerio", "gerenciar_repertorio"];

export async function PATCH(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.usuarioId !== "string" || typeof body.ministerio !== "string") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const ator = await acessoMinisterio(auth.admin, auth.user.id, body.ministerio);
    if (!ator.lider) return forbidden();
    if (typeof body.funcao === "string") {
      if (!["Líder", "Colíder", "Voluntário(a)", ...(body.ministerio === "Louvor" ? ["Ministro"] : [])].includes(body.funcao)) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
      const { error } = await auth.admin.rpc("alterar_lideranca_ministerio", { p_usuario: body.usuarioId, p_ministerio: body.ministerio, p_funcao: body.funcao });
      if (error) return NextResponse.json({ error: "Não foi possível alterar a função." }, { status: 400 });
    } else {
      if (!Array.isArray(body.permissoes) || body.permissoes.some((p: unknown) => typeof p !== "string" || !DELEGAVEIS.includes(p))) return NextResponse.json({ error: "Permissões inválidas." }, { status: 400 });
      const { data: perfil, error: perfilError } = await auth.admin.from("perfis").select("ministerios").eq("id", body.usuarioId).maybeSingle();
      if (perfilError || !perfil?.ministerios?.includes(body.ministerio)) return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
      const { data: registro, error: buscaError } = await auth.admin.from("membros_ministerio").select("id").eq("usuario_id", body.usuarioId).eq("ministerio", body.ministerio).maybeSingle();
      if (buscaError) return NextResponse.json({ error: "Não foi possível carregar o membro." }, { status: 500 });
      const result = registro
        ? await auth.admin.from("membros_ministerio").update({ permissoes_canal: [...new Set(body.permissoes)] }).eq("id", registro.id)
        : await auth.admin.from("membros_ministerio").insert({ usuario_id: body.usuarioId, ministerio: body.ministerio, funcao: "Voluntário(a)", permissoes_canal: [...new Set(body.permissoes)] });
      if (result.error) return NextResponse.json({ error: "Não foi possível salvar as permissões." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Não foi possível verificar a liderança." }, { status: 500 }); }
}
