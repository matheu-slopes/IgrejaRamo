import { NextRequest, NextResponse } from "next/server";
import {
  getLouvorStudioAccess,
  getLouvorStudioUser,
  louvorStudioAdmin,
  workerConfigurado,
  youtubeConfigurado,
} from "@/lib/louvorStudioServer";

export async function GET(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ autorizado: false }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);
  const { data: workers, error: workersError } = await louvorStudioAdmin
    .from("louvor_studio_workers")
    .select("worker_id,nome,visto_em")
    .order("visto_em", { ascending: false })
    .limit(20);
  const processadores = workersError ? null : (workers ?? []).map((worker) => {
    const vistoEm = new Date(worker.visto_em).getTime();
    return {
      id: worker.worker_id,
      nome: worker.nome,
      vistoEm: worker.visto_em,
      online: Number.isFinite(vistoEm) && Date.now() - vistoEm <= 30_000,
    };
  });

  return NextResponse.json({
    autorizado: acesso.podeVer,
    podeGerenciar: acesso.podeGerenciar,
    podePrepararEnsaio: acesso.podeGerenciar,
    workerConfigurado: workerConfigurado(),
    workerOnline: processadores === null ? null : processadores.some((worker) => worker.online),
    workers: processadores,
    youtubeConfigurado: youtubeConfigurado(),
  });
}
