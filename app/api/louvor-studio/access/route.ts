import { NextRequest, NextResponse } from "next/server";
import {
  getLouvorStudioAccess,
  getLouvorStudioUser,
  workerConfigurado,
  youtubeConfigurado,
} from "@/lib/louvorStudioServer";

export async function GET(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ autorizado: false }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);

  return NextResponse.json({
    autorizado: acesso.podeVer,
    podeGerenciar: acesso.podeGerenciar,
    podePrepararEnsaio: acesso.podeVer,
    workerConfigurado: workerConfigurado(),
    youtubeConfigurado: youtubeConfigurado(),
  });
}
