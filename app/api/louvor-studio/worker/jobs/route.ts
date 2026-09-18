import { NextRequest, NextResponse } from "next/server";
import { limparProjetosExpirados, louvorStudioAdmin, validarWorker } from "@/lib/louvorStudioServer";

export async function GET(req: NextRequest) {
  if (!validarWorker(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  await limparProjetosExpirados();

  const limiteTravado = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  await louvorStudioAdmin.from("louvor_studio_projetos")
    .update({ status: "aguardando", progresso: 0, processando_em: null, worker_id: null })
    .in("status", ["baixando", "analisando", "separando"])
    .eq("pipeline_version", 1)
    .lt("processando_em", limiteTravado);

  const { data: candidato, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .select("id, youtube_url, titulo, artista, tom_alvo, escala_id")
    .eq("status", "aguardando")
    .eq("pipeline_version", 1)
    .order("criado_em")
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!candidato) return NextResponse.json({ job: null });

  const workerId = req.headers.get("x-worker-id")?.slice(0, 100) || "worker-local";
  const { data: job } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .update({ status: "baixando", progresso: 2, processando_em: new Date().toISOString(), worker_id: workerId, erro: null })
    .eq("id", candidato.id)
    .eq("status", "aguardando")
    .eq("pipeline_version", 1)
    .select("id, youtube_url, titulo, artista, tom_alvo, escala_id")
    .maybeSingle();
  return NextResponse.json({ job: job ?? null });
}
