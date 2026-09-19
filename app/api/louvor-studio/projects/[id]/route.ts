import { NextRequest, NextResponse } from "next/server";
import {
  getLouvorStudioAccess,
  getLouvorStudioUser,
  louvorStudioAdmin as db,
} from "@/lib/louvorStudioServer";
import { listarAudios, removerAudios } from "@/lib/louvorStudioStorage";

type Context = { params: Promise<{ id: string }> };
const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );

export async function DELETE(req: NextRequest, context: Context) {
  const user = await getLouvorStudioUser(req);
  if (!user)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await getLouvorStudioAccess(user.id)).podeGerenciar)
    return NextResponse.json(
      { error: "Somente líderes podem excluir músicas." },
      { status: 403 },
    );
  const { id } = await context.params;
  if (!validId(id))
    return NextResponse.json({ error: "Música inválida." }, { status: 400 });
  const { data: project, error: lookupError } = await db
    .from("louvor_studio_projetos")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !project)
    return NextResponse.json({ error: "Música não encontrada." }, { status: 404 });
  if (!["concluido", "erro"].includes(project.status))
    return NextResponse.json(
      { error: "Aguarde o processamento terminar antes de excluir." },
      { status: 409 },
    );
  let paths: string[];
  try { paths = await listarAudios(id); } catch {
    return NextResponse.json({ error: "Não foi possível localizar os arquivos da música." }, { status: 500 });
  }
  if (paths.length) {
    try { await removerAudios(paths); } catch {
      return NextResponse.json(
        { error: "Não foi possível remover os arquivos da música." },
        { status: 500 },
      );
    }
  }
  const { error: deleteError } = await db
    .from("louvor_studio_projetos")
    .delete()
    .eq("id", id);
  if (deleteError)
    return NextResponse.json(
      { error: "Os arquivos foram removidos, mas não foi possível excluir a música." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}

/** Confirma no culto o tom que o ministro testou no player do Studio. */
export async function PATCH(req: NextRequest, context: Context) {
  const user = await getLouvorStudioUser(req);
  if (!user)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await getLouvorStudioAccess(user.id)).podeGerenciar)
    return NextResponse.json({ error: "Somente ministros e líderes podem confirmar a análise." }, { status: 403 });
  const { id } = await context.params;
  if (!validId(id))
    return NextResponse.json({ error: "Música inválida." }, { status: 400 });
  const body = await req.json().catch(() => ({})) as {
    action?: string;
    tom?: string;
    bpm?: number;
    escalaId?: string;
    musicaId?: string;
  };

  const { data: projeto, error } = await db
    .from("louvor_studio_projetos")
    .select("id,status,escala_id,musica_id,tom_original,bpm")
    .eq("id", id)
    .maybeSingle();
  if (error || !projeto)
    return NextResponse.json({ error: "Música não encontrada." }, { status: 404 });

  if (body.action === "retry") {
    if (projeto.status !== "erro")
      return NextResponse.json({ error: "Somente uma preparação com falha pode ser tentada novamente." }, { status: 409 });
    const { error: retryError } = await db
      .from("louvor_studio_projetos")
      .update({
        status: "aguardando",
        progresso: 0,
        erro: null,
        worker_id: null,
        claim_token: null,
        tentativas: 0,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "erro");
    if (retryError)
      return NextResponse.json({ error: "Não foi possível colocar a preparação na fila novamente." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "aguardando" });
  }

  if (projeto.status !== "concluido")
    return NextResponse.json({ error: "Aguarde a análise terminar." }, { status: 409 });
  const escalaId = typeof body.escalaId === "string" && validId(body.escalaId)
    ? body.escalaId
    : projeto.escala_id;
  const musicaId = typeof body.musicaId === "string" && validId(body.musicaId)
    ? body.musicaId
    : projeto.musica_id;
  if (!escalaId || !musicaId)
    return NextResponse.json({ error: "Esta preparação não foi iniciada a partir de uma música da escala." }, { status: 409 });
  if (!projeto.tom_original && !projeto.bpm)
    return NextResponse.json({ error: "O Studio não conseguiu identificar tom ou BPM nesta gravação." }, { status: 409 });

  const tomEscolhido = typeof body.tom === "string" ? body.tom.trim() : projeto.tom_original;
  if (!/^[A-G](?:#|b)?m?$/.test(tomEscolhido ?? ""))
    return NextResponse.json({ error: "Escolha uma tonalidade válida no player." }, { status: 400 });
  const bpmEscolhido = typeof body.bpm === "number" && Number.isFinite(body.bpm) && body.bpm > 0
    ? Number(body.bpm.toFixed(2))
    : projeto.bpm ?? null;

  if (escalaId !== projeto.escala_id || musicaId !== projeto.musica_id) {
    const { data: vinculo } = await db
      .from("escala_musicas")
      .select("id")
      .eq("escala_id", escalaId)
      .eq("musica_id", musicaId)
      .eq("studio_projeto_id", projeto.id)
      .maybeSingle();
    if (!vinculo)
      return NextResponse.json({ error: "Esta base não está vinculada à música desta escala." }, { status: 409 });
  }

  const { error: updateError } = await db
    .from("escala_musicas")
    .update({ tom: tomEscolhido, bpm: bpmEscolhido })
    .eq("escala_id", escalaId)
    .eq("musica_id", musicaId);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, tom: tomEscolhido, bpm: bpmEscolhido });
}
