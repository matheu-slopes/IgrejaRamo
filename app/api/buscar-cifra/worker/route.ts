import { NextRequest, NextResponse } from "next/server";
import { louvorStudioAdmin as db, validarWorker } from "@/lib/louvorStudioServer";
import { searchYoutube } from "@/lib/youtubeSearch";

export const maxDuration = 15;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  if (!validarWorker(req)) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const worker = req.headers.get("x-worker-id")?.slice(0, 100) || "worker-local";
  const { data: job, error } = await db.rpc("claim_cifra_job", { p_worker: worker });
  if (error) return NextResponse.json({ error: "Migracao da fila indisponivel." }, { status: 503 });
  return NextResponse.json({ job: job ?? null });
}

export async function POST(req: NextRequest) {
  if (!validarWorker(req)) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id ?? "");
  const claimToken = String(body?.claimToken ?? "");
  const worker = req.headers.get("x-worker-id")?.slice(0, 100) || "worker-local";
  if (!UUID_RE.test(id) || !UUID_RE.test(claimToken)) {
    return NextResponse.json({ error: "Tarefa invalida." }, { status: 400 });
  }
  const { data: job } = await db.from("cifra_jobs").select("id,status")
    .eq("id", id).eq("status", "processando").eq("worker_id", worker)
    .eq("claim_token", claimToken).maybeSingle();
  if (!job) return NextResponse.json({ error: "A tarefa nao pertence mais a este worker." }, { status: 409 });

  const now = new Date().toISOString();
  if (body?.action === "complete") {
    const result = body.result;
    const serialized = JSON.stringify(result ?? null);
    const parsed = (result ?? {}) as Record<string, unknown>;
    if (serialized.length < 50 || serialized.length > 600_000 || !Array.isArray(parsed.cifra) || parsed.cifra.length < 3) {
      return NextResponse.json({ error: "Resultado de cifra invalido." }, { status: 400 });
    }
    let resultadoCompleto = parsed;
    if (!parsed.youtube_url && typeof parsed.name === "string" && typeof parsed.artist === "string") {
      try {
        const videos = await searchYoutube(
          `${parsed.name} ${parsed.artist}`, AbortSignal.timeout(5_000), process.env.YOUTUBE_API_KEY,
        );
        if (videos[0]?.url) resultadoCompleto = { ...parsed, youtube_url: videos[0].url };
      } catch {
        // A cifra continua valida quando o YouTube estiver temporariamente indisponivel.
      }
    }
    const { error } = await db.from("cifra_jobs").update({
      status: "concluido", resultado: resultadoCompleto, erro: null, worker_id: null,
      claim_token: null, atualizado_em: now,
    }).eq("id", id).eq("claim_token", claimToken);
    if (error) return NextResponse.json({ error: "Nao foi possivel concluir a tarefa." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "fail") {
    const detail = typeof body.detail === "string"
      ? body.detail.slice(0, 300)
      : "O processador local nao conseguiu obter a cifra.";
    const { error } = await db.from("cifra_jobs").update({
      status: "erro", erro: detail, resultado: null, worker_id: null,
      claim_token: null, atualizado_em: now,
    }).eq("id", id).eq("claim_token", claimToken);
    if (error) return NextResponse.json({ error: "Nao foi possivel registrar a falha." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
}
