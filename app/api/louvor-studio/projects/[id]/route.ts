import { NextRequest, NextResponse } from "next/server";
import { getLouvorStudioAccess, getLouvorStudioUser, louvorStudioAdmin as db } from "@/lib/louvorStudioServer";
import { listarAudios, removerAudios } from "@/lib/louvorStudioStorage";

type Context = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const expiraEmDias = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString();

async function projetoDoPedido(req: NextRequest, context: Context) {
  const user = await getLouvorStudioUser(req);
  if (!user) return { response: NextResponse.json({ error: "Nao autorizado." }, { status: 401 }) };
  const acesso = await getLouvorStudioAccess(user.id);
  if (!acesso.podeVer) return { response: NextResponse.json({ error: "Acesso restrito ao ministerio de Louvor." }, { status: 403 }) };
  const { id } = await context.params;
  if (!validId(id)) return { response: NextResponse.json({ error: "Musica invalida." }, { status: 400 }) };
  const { data: projeto, error } = await db.from("louvor_studio_projetos")
    .select("id,status,visibilidade,criado_por,escala_id,musica_id,tom_original,tom_base_confirmado,bpm")
    .eq("id", id).maybeSingle();
  if (error || !projeto) return { response: NextResponse.json({ error: "Musica nao encontrada." }, { status: 404 }) };
  const eDono = projeto.criado_por === user.id;
  if (projeto.visibilidade === "pessoal" && !eDono) return { response: NextResponse.json({ error: "Este ensaio e privado." }, { status: 403 }) };
  return { user, acesso, projeto, eDono };
}

export async function DELETE(req: NextRequest, context: Context) {
  const contexto = await projetoDoPedido(req, context);
  if ("response" in contexto) return contexto.response;
  const { projeto, acesso, eDono } = contexto;
  if (!acesso.podeGerenciar && !(projeto.visibilidade === "pessoal" && eDono)) return NextResponse.json({ error: "Sem permissao para excluir esta musica." }, { status: 403 });
  if (!["concluido", "erro"].includes(projeto.status)) return NextResponse.json({ error: "Aguarde o processamento terminar antes de excluir." }, { status: 409 });
  let paths: string[];
  try { paths = await listarAudios(projeto.id); } catch { return NextResponse.json({ error: "Nao foi possivel localizar os arquivos da musica." }, { status: 500 }); }
  if (paths.length) {
    try { await removerAudios(paths); } catch { return NextResponse.json({ error: "Nao foi possivel remover os arquivos da musica." }, { status: 500 }); }
  }
  const { error } = await db.from("louvor_studio_projetos").delete().eq("id", projeto.id);
  if (error) return NextResponse.json({ error: "Os arquivos foram removidos, mas o registro nao foi excluido." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, context: Context) {
  const contexto = await projetoDoPedido(req, context);
  if ("response" in contexto) return contexto.response;
  const { projeto, acesso, eDono } = contexto;
  const body = await req.json().catch(() => ({})) as { action?: string; tom?: string; bpm?: number; escalaId?: string; musicaId?: string };

  if (body.action === "usar") {
    const dias = projeto.visibilidade === "pessoal" ? 7 : 90;
    const { error } = await db.from("louvor_studio_projetos")
      .update({ ultimo_uso_em: new Date().toISOString(), expira_em: expiraEmDias(dias) }).eq("id", projeto.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "confirmar_tom_base") {
    if (!acesso.podeGerenciar) return NextResponse.json({ error: "Somente ministros e lideres podem confirmar o tom-base." }, { status: 403 });
    if (projeto.status !== "concluido") return NextResponse.json({ error: "Aguarde a analise terminar." }, { status: 409 });
    const tom = typeof body.tom === "string" ? body.tom.trim() : "";
    if (!/^[A-G](?:#|b)?m?$/.test(tom)) return NextResponse.json({ error: "Escolha uma tonalidade valida." }, { status: 400 });
    const { error } = await db.from("louvor_studio_projetos").update({ tom_base_confirmado: tom }).eq("id", projeto.id);
    if (error) return NextResponse.json({ error: error.code === "PGRST204" || error.code === "42703" ? "Aplique a migration 20260920_louvor_studio_confirma_tom_base.sql no Supabase." : error.message }, { status: 500 });
    return NextResponse.json({ ok: true, tom });
  }

  if (body.action === "retry") {
    if (!acesso.podeGerenciar && !(projeto.visibilidade === "pessoal" && eDono)) return NextResponse.json({ error: "Sem permissao para tentar novamente." }, { status: 403 });
    if (projeto.status !== "erro") return NextResponse.json({ error: "Somente uma preparacao com falha pode ser tentada novamente." }, { status: 409 });
    const { error } = await db.from("louvor_studio_projetos").update({
      status: "aguardando", progresso: 0, erro: null, worker_id: null, claim_token: null, tentativas: 0, atualizado_em: new Date().toISOString(),
    }).eq("id", projeto.id).eq("status", "erro");
    if (error) return NextResponse.json({ error: "Nao foi possivel colocar a preparacao na fila novamente." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "aguardando" });
  }

  if (!acesso.podeGerenciar) return NextResponse.json({ error: "Somente ministros e lideres podem confirmar o tom da escala." }, { status: 403 });
  if (projeto.status !== "concluido") return NextResponse.json({ error: "Aguarde a analise terminar." }, { status: 409 });
  const escalaId = typeof body.escalaId === "string" && validId(body.escalaId) ? body.escalaId : projeto.escala_id;
  const musicaId = typeof body.musicaId === "string" && validId(body.musicaId) ? body.musicaId : projeto.musica_id;
  if (!escalaId || !musicaId) return NextResponse.json({ error: "Esta preparacao nao foi iniciada a partir de uma musica da escala." }, { status: 409 });
  if (!projeto.tom_original && !projeto.bpm) return NextResponse.json({ error: "O Studio nao conseguiu identificar tom ou BPM nesta gravacao." }, { status: 409 });
  const tomEscolhido = typeof body.tom === "string" ? body.tom.trim() : projeto.tom_original;
  if (!/^[A-G](?:#|b)?m?$/.test(tomEscolhido ?? "")) return NextResponse.json({ error: "Escolha uma tonalidade valida no player." }, { status: 400 });
  const bpmEscolhido = typeof body.bpm === "number" && Number.isFinite(body.bpm) && body.bpm > 0 ? Number(body.bpm.toFixed(2)) : projeto.bpm ?? null;
  if (escalaId !== projeto.escala_id || musicaId !== projeto.musica_id) {
    const { data: vinculo } = await db.from("escala_musicas").select("id").eq("escala_id", escalaId).eq("musica_id", musicaId).eq("studio_projeto_id", projeto.id).maybeSingle();
    if (!vinculo) return NextResponse.json({ error: "Esta base nao esta vinculada a musica desta escala." }, { status: 409 });
  }
  const { error } = await db.from("escala_musicas").update({ tom: tomEscolhido, bpm: bpmEscolhido }).eq("escala_id", escalaId).eq("musica_id", musicaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tom: tomEscolhido, bpm: bpmEscolhido });
}
