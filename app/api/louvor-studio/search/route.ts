import { NextRequest, NextResponse } from "next/server";
import { chamarLouvorStudioWorker, getLouvorStudioUser, podeUsarLouvorStudio } from "@/lib/louvorStudioServer";

export async function POST(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!(await podeUsarLouvorStudio(user.id))) {
    return NextResponse.json({ error: "Acesso permitido somente a ministros e líderes do Louvor." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { query?: string } | null;
  const query = body?.query?.trim();
  if (!query || query.length < 2) return NextResponse.json({ error: "Informe uma música para pesquisar." }, { status: 400 });

  try {
    const response = await chamarLouvorStudioWorker("/search", {
      method: "POST",
      body: JSON.stringify({ query: query.slice(0, 120) }),
    });
    const data = await response.json().catch(() => ({ error: "Resposta inválida do processador." }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Processador indisponível." }, { status: 503 });
  }
}

