import { NextRequest, NextResponse } from "next/server";
import {
  validarWorker,
  louvorStudioAdmin as db,
} from "@/lib/louvorStudioServer";
import { signedPaths, uuidValid } from "@/lib/louvorStudioHqServer";
import { stemNames } from "@/lib/louvorStudioMusic";
import { criarUrlDeEnvio, existeAudio, removerAudios } from "@/lib/louvorStudioStorage";
export async function GET(req: NextRequest) {
  if (!validarWorker(req))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const worker =
    req.headers.get("x-worker-id")?.slice(0, 100) || "worker-local";
  const { data: job, error } = await db.rpc("claim_louvor_hq", {
    p_worker: worker,
  });
  if (error)
    return NextResponse.json(
      { error: "Migração HQ indisponível." },
      { status: 503 },
    );
  if (!job) return NextResponse.json({ job: null });
  if (job.kind === "pitch") {
    const lossless = job.project.lossless_stems ?? {};
    const paths = Object.keys(lossless).length ? lossless : job.project.stems;
    job.inputs = await signedPaths(paths, job.project.id);
  }
  return NextResponse.json({ job });
}
export async function POST(req: NextRequest) {
  if (!validarWorker(req))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (
    !body ||
    !uuidValid(body.id ?? "") ||
    !uuidValid(body.claimToken ?? "") ||
    !["pitch", "separate"].includes(body.kind)
  )
    return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
  const table =
    body.kind === "pitch" ? "louvor_studio_versions" : "louvor_studio_projetos";
  const { data: row } = await db
    .from(table)
    .select("*")
    .eq("id", body.id)
    .eq("claim_token", body.claimToken)
    .eq("worker_id", req.headers.get("x-worker-id")?.slice(0, 100) || "worker-local")
    .maybeSingle();
  if (
    !row ||
    !["processando", "baixando", "analisando", "separando"].includes(row.status)
  )
    return NextResponse.json(
      { error: "A tarefa não pertence mais a este processador." },
      { status: 409 },
    );
  const projectId = body.kind === "pitch" ? row.projeto_id : row.id;
  const { data: project } = await db
    .from("louvor_studio_projetos")
    .select("id,separation_mode,expira_em")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || new Date(project.expira_em) <= new Date())
    return NextResponse.json({ error: "Projeto expirado." }, { status: 410 });
  const names = stemNames(project.separation_mode);
  const prefix = body.kind === "pitch" ? "v_" + row.id + "_" + row.claim_token : "base_" + row.claim_token;
  const expected: Record<string, string> = {};
  names.forEach((n) => {
    expected[n] = projectId + "/" + prefix + "_" + n + ".mp3";
  });
  if (body.kind === "pitch") {
    expected.mix_wav = projectId + "/" + prefix + "_mix.flac";
    expected.mix_mp3 = projectId + "/" + prefix + "_mix.mp3";
  } else
    names.forEach((n) => {
      expected[n + "_wav"] = projectId + "/" + prefix + "_" + n + ".flac";
    });
  if (body.action === "uploads") {
    const uploads: Record<string, unknown> = {};
    for (const [name, path] of Object.entries(expected)) {
      try {
        uploads[name] = { path, signedUrl: await criarUrlDeEnvio(path) };
      } catch {
        return NextResponse.json(
          { error: "Falha ao preparar envio." },
          { status: 502 },
        );
      }
    }
    return NextResponse.json({ uploads });
  }
  const update: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };
  if (body.action === "heartbeat") {
    if (Number.isFinite(body.progress))
      update.progresso = Math.max(
        row.progresso,
        Math.min(99, Math.floor(body.progress)),
      );
    if (
      body.kind === "separate" &&
      ["baixando", "analisando", "separando"].includes(body.stage)
    )
      update.status = body.stage;
  } else if (body.action === "complete") {
    if (!(await Promise.all(Object.values(expected).map(existeAudio))).every(Boolean))
      return NextResponse.json({ error: "Envio incompleto." }, { status: 409 });
    update.status = "concluido";
    update.progresso = 100;
    update.erro = null;
    update.claim_token = null;
    update.stems = Object.fromEntries(names.map((n) => [n, expected[n]]));
    if (body.kind === "pitch") {
      update.mix_wav = expected.mix_wav;
      update.mix_mp3 = expected.mix_mp3;
    } else {
      if (typeof body.title === "string")
        update.titulo = body.title.slice(0, 500);
      if (typeof body.artist === "string")
        update.artista = body.artist.slice(0, 300);
      if (
        typeof body.thumbnail === "string" &&
        body.thumbnail.startsWith("https://")
      )
        update.thumbnail_url = body.thumbnail;
      update.lossless_stems = Object.fromEntries(
        names.map((n) => [n, expected[n + "_wav"]]),
      );
      if (typeof body.key === "string" && /^[A-G][#b]?m?$/.test(body.key))
        update.tom_original = body.key;
      if (Number.isFinite(body.bpm) && body.bpm > 0 && body.bpm < 400)
        update.bpm = body.bpm;
      if (
        Number.isFinite(body.beat_offset_seg) &&
        body.beat_offset_seg >= 0 &&
        body.beat_offset_seg < 60
      )
        update.beat_offset_seg = body.beat_offset_seg;
      if (Number.isFinite(body.duration))
        update.duracao_segundos = body.duration;
      if (typeof body.hash === "string" && /^[a-f0-9]{64}$/.test(body.hash))
        update.audio_hash = body.hash;
      if (typeof body.model === "string")
        update.model_version = body.model.slice(0, 160);
    }
  } else if (body.action === "fail") {
    const workerDetail =
      typeof body.detail === "string" &&
      body.detail.startsWith("O Storage recusou uma faixa")
        ? body.detail.slice(0, 300)
        : null;
    update.status = "erro";
    update.erro =
      body.configuration === true
        ? "Verifique a instalação do Audio Separator e Rubber Band R3 no processador."
        : workerDetail ?? "O processamento falhou. Tente novamente; detalhes no registro do processador.";
    update.claim_token = null;
    update.progresso = 0;
    // Remove only incomplete outputs belonging to this attempt.
    await removerAudios(Object.values(expected));
  } else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const { data: changed, error } = await db
    .from(table)
    .update(update)
    .eq("id", body.id)
    .eq("claim_token", body.claimToken)
    .select("id");
  if (error || !changed?.length)
    return NextResponse.json(
      { error: "Não foi possível atualizar a tarefa." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true });
}
