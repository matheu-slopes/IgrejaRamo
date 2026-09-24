import { NextRequest, NextResponse } from "next/server";
import { getLouvorStudioUser, louvorStudioAdmin as db } from "@/lib/louvorStudioServer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Tarefa invalida." }, { status: 400 });

  const { data: job, error } = await db.from("cifra_jobs")
    .select("status,resultado,erro,atualizado_em,expira_em")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Nao foi possivel consultar a tarefa." }, { status: 503 });
  if (!job || new Date(job.expira_em) <= new Date()) {
    return NextResponse.json({ error: "A busca expirou. Tente novamente." }, { status: 410 });
  }
  return NextResponse.json({
    status: job.status,
    result: job.status === "concluido" ? job.resultado : undefined,
    error: job.status === "erro" ? job.erro : undefined,
    updatedAt: job.atualizado_em,
  });
}
