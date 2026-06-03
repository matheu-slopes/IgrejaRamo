import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AcaoConfirmacao = "confirmar" | "recusar";

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user ?? null;
}

function erroColunaConfirmacaoAusente(error: unknown): boolean {
  const err = error as { message?: string } | null;
  const message = String(err?.message ?? "").toLowerCase();
  return (
    message.includes("'confirmado' column") ||
    message.includes("'confirmacao_status' column") ||
    message.includes("confirmado") && message.includes("schema cache") ||
    message.includes("confirmacao_status") && message.includes("schema cache")
  );
}

export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { escalaId?: string; acao?: AcaoConfirmacao } | null;
  const escalaId = body?.escalaId;
  const acao: AcaoConfirmacao = body?.acao === "recusar" ? "recusar" : "confirmar";
  if (!escalaId) return NextResponse.json({ error: "Escala não informada" }, { status: 400 });

  const { data: escala, error: escalaErr } = await admin
    .from("escalas")
    .select("id, confirmacao_participantes")
    .eq("id", escalaId)
    .maybeSingle();

  if (escalaErr) return NextResponse.json({ error: escalaErr.message }, { status: 500 });
  if (!escala) return NextResponse.json({ error: "Escala não encontrada" }, { status: 404 });
  if (!escala.confirmacao_participantes) {
    return NextResponse.json({ error: "Esta escala não solicita confirmação" }, { status: 400 });
  }

  const { data: itens, error: itensErr } = await admin
    .from("escala_itens")
    .select("id")
    .eq("escala_id", escalaId)
    .eq("voluntario_id", user.id);

  if (itensErr) return NextResponse.json({ error: itensErr.message }, { status: 500 });
  if (!itens?.length) {
    return NextResponse.json({ error: "Você não está nesta escala" }, { status: 403 });
  }

  const confirmadoEm = new Date().toISOString();
  const status = acao === "recusar" ? "recusado" : "confirmado";
  const { error: updateErr } = await admin
    .from("escala_itens")
    .update({
      confirmado: acao === "confirmar",
      confirmado_em: confirmadoEm,
      confirmacao_status: status,
    })
    .eq("escala_id", escalaId)
    .eq("voluntario_id", user.id);

  if (updateErr) {
    if (erroColunaConfirmacaoAusente(updateErr)) {
      return NextResponse.json({
        error: "A confirmação ainda precisa ser ativada no banco. Aplique a migration de status de confirmação no Supabase e tente novamente.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, confirmadoEm, status });
}
