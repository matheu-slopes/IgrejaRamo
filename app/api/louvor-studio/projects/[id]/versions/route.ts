import { NextRequest, NextResponse } from "next/server";
import {
  getLouvorStudioUser,
  podeVerLouvorStudio,
  louvorStudioAdmin as db,
} from "@/lib/louvorStudioServer";
import { uuidValid, signedVersion } from "@/lib/louvorStudioHqServer";
import {
  transposeSemitones,
  QUALITY_VERSION,
  Direction,
} from "@/lib/louvorStudioMusic";
type Context = { params: Promise<{ id: string }> };
async function authorized(req: NextRequest, id: string) {
  const user = await getLouvorStudioUser(req);
  if (!user)
    return {
      response: NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 },
      ),
    };
  if (!uuidValid(id))
    return {
      response: NextResponse.json(
        { error: "Projeto inválido." },
        { status: 400 },
      ),
    };
  if (!(await podeVerLouvorStudio(user.id)))
    return {
      response: NextResponse.json(
        { error: "Acesso restrito ao Louvor." },
        { status: 403 },
      ),
    };
  const { data: project } = await db
    .from("louvor_studio_projetos")
    .select("id,status,expira_em")
    .eq("id", id)
    .maybeSingle();
  if (!project || new Date(project.expira_em) <= new Date())
    return {
      response: NextResponse.json(
        { error: "Música indisponível ou expirada." },
        { status: 404 },
      ),
    };
  return { user, project };
}
export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params,
    access = await authorized(req, id);
  if (access.response) return access.response;
  const { data, error } = await db
    .from("louvor_studio_versions")
    .select("*")
    .eq("projeto_id", id)
    .eq("engine", QUALITY_VERSION);
  if (error)
    return NextResponse.json(
      { error: "Aplique a migração de áudio HQ para habilitar as versões." },
      { status: 503 },
    );
  return NextResponse.json({
    versions: await Promise.all((data ?? []).map((v) => signedVersion(v, id))),
  });
}
export async function POST(req: NextRequest, context: Context) {
  const { id } = await context.params,
    access = await authorized(req, id);
  if (access.response) return access.response;
  if (access.project?.status !== "concluido")
    return NextResponse.json(
      { error: "Aguarde a separação terminar." },
      { status: 409 },
    );
  const body = await req.json().catch(() => null);
  let semitones: number;
  try {
    if (typeof body?.original !== "string" || typeof body?.target !== "string")
      throw Error("Selecione o tom original e o novo tom.");
    semitones = transposeSemitones(
      body.original,
      body.target,
      (body.direction ?? "auto") as Direction,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Tonalidade inválida.",
      },
      { status: 400 },
    );
  }
  const requestedSpeed = body?.speed ?? 1;
  // The interface receives a target BPM and converts it to this ratio. Keep
  // whole-BPM precision while preventing impractical extreme time-stretching.
  const speed =
    typeof requestedSpeed === "number"
      ? Number(requestedSpeed.toFixed(6))
      : requestedSpeed;
  if (
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    speed < 0.5 ||
    speed > 1.5
  )
    return NextResponse.json(
      { error: "Velocidade inválida." },
      { status: 400 },
    );
  const match = () =>
    db
      .from("louvor_studio_versions")
      .select("*")
      .eq("projeto_id", id)
      .eq("semitones", semitones)
      .eq("speed", speed)
      .eq("engine", QUALITY_VERSION)
      .maybeSingle();
  const { data: existing, error: lookupError } = await match();
  if (lookupError)
    return NextResponse.json(
      { error: "Aplique a migração de áudio HQ para habilitar as versões." },
      { status: 503 },
    );
  if (existing && existing.status !== "erro")
    return NextResponse.json({
      version: await signedVersion(existing, id),
      cached: true,
    });
  if (existing && existing.tentativas >= 3)
    return NextResponse.json(
      { error: "Esta versão falhou três vezes. Verifique o processador." },
      { status: 409 },
    );
  const { count, error: countError } = await db
    .from("louvor_studio_versions")
    .select("id", { count: "exact", head: true })
    .eq("criado_por", access.user!.id)
    .in("status", ["aguardando", "processando"]);
  if (countError || (count ?? 0) >= 3)
    return NextResponse.json(
      { error: "Aguarde suas versões em processamento antes de pedir outra." },
      { status: 429 },
    );
  if (existing) {
    const { data, error } = await db
      .from("louvor_studio_versions")
      .update({ status: "aguardando", erro: null, progresso: 0 })
      .eq("id", existing.id)
      .eq("status", "erro")
      .select("*")
      .maybeSingle();
    if (error || !data)
      return NextResponse.json({ error: "Tente novamente." }, { status: 409 });
    return NextResponse.json(
      { version: await signedVersion(data, id) },
      { status: 202 },
    );
  }
  const { data, error } = await db
    .from("louvor_studio_versions")
    .insert({
      projeto_id: id,
      semitones,
      speed,
      engine: QUALITY_VERSION,
      criado_por: access.user!.id,
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: concurrent } = await match();
    if (concurrent)
      return NextResponse.json({
        version: await signedVersion(concurrent, id),
        cached: true,
      });
  }
  if (error || !data)
    return NextResponse.json(
      { error: "Não foi possível preparar esse tom." },
      { status: 500 },
    );
  return NextResponse.json(
    { version: await signedVersion(data, id) },
    { status: 202 },
  );
}
