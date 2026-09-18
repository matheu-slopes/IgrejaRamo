import { NextRequest, NextResponse } from "next/server";
import { louvorStudioAdmin, validarWorker } from "@/lib/louvorStudioServer";

const STATUS = new Set(["baixando", "analisando", "separando", "concluido", "erro"]);
const STEMS = ["vocals", "drums", "bass", "other"] as const;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!validarWorker(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action !== "upload_urls") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const uploads: Record<string, { path: string; signedUrl: string; token: string }> = {};
  for (const stem of STEMS) {
    const path = id + "/" + stem + ".mp3";
    const { data, error } = await louvorStudioAdmin.storage.from("louvor-studio").createSignedUploadUrl(path, { upsert: true });
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha ao assinar upload." }, { status: 500 });
    uploads[stem] = { path, signedUrl: data.signedUrl, token: data.token };
  }
  return NextResponse.json({ uploads });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!validarWorker(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !STATUS.has(String(body.status))) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

  const status = String(body.status);
  const update: Record<string, unknown> = {
    status,
    progresso: Math.max(0, Math.min(100, Number(body.progresso ?? 0))),
    atualizado_em: new Date().toISOString(),
  };
  for (const key of ["titulo", "artista", "thumbnail_url", "tom_original", "bpm", "beat_offset_seg", "duracao_segundos", "erro"]) {
    if (key in body) update[key] = body[key];
  }
  if (status === "concluido") {
    const stems = body.stems as Record<string, string> | undefined;
    if (!stems || STEMS.some((stem) => stems[stem] !== id + "/" + stem + ".mp3")) {
      return NextResponse.json({ error: "Caminhos das faixas inválidos." }, { status: 400 });
    }
    update.stems = stems;
    update.audio_path = null;
    update.progresso = 100;
  }

  const { error } = await louvorStudioAdmin.from("louvor_studio_projetos").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
