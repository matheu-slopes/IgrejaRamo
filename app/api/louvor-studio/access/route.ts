import { NextRequest, NextResponse } from "next/server";
import { getLouvorStudioUser, podeUsarLouvorStudio, workerConfigurado } from "@/lib/louvorStudioServer";

export async function GET(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ autorizado: false }, { status: 401 });

  return NextResponse.json({
    autorizado: await podeUsarLouvorStudio(user.id),
    workerConfigurado: workerConfigurado(),
  });
}

