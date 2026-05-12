import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers, sendPushToAll } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/test
 * Envia notificação de teste. Requer usuário autenticado (admin).
 * Body: { tipo: "aviso" | "evento" | "chat" | "escala" }
 *   - "aviso"  → broadcast para todos
 *   - "evento" → broadcast para todos
 *   - "chat"   → envia somente para o próprio usuário logado
 *   - "escala" → envia somente para o próprio usuário logado
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { tipo } = await req.json() as { tipo: string };

  // Conta quantas subscriptions existem
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) === 0) {
    return NextResponse.json(
      { error: "Nenhuma subscription registrada. Ative as notificações primeiro no PWA." },
      { status: 422 }
    );
  }

  try {
    if (tipo === "aviso") {
      await sendPushToAll({
        title: "📢 Teste — Novo Aviso",
        body: "Este é um aviso de teste do sistema de notificações.",
        url: "/dashboard/mural",
        tag: "teste-aviso",
      });
      return NextResponse.json({ ok: true, enviado: "broadcast", subscriptions: count });
    }

    if (tipo === "evento") {
      await sendPushToAll({
        title: "📅 Teste — Novo Evento",
        body: "Culto de teste · Igreja Ramo da Videira",
        url: "/dashboard/eventos",
        tag: "teste-evento",
      });
      return NextResponse.json({ ok: true, enviado: "broadcast", subscriptions: count });
    }

    if (tipo === "chat") {
      await sendPushToUsers([user.id], {
        title: "💬 Teste — Nova Mensagem",
        body: "Fulano: Esta é uma mensagem de teste no chat.",
        url: "/dashboard/chat",
        tag: "teste-chat",
      });
      return NextResponse.json({ ok: true, enviado: "somente_voce", subscriptions: count });
    }

    if (tipo === "escala") {
      await sendPushToUsers([user.id], {
        title: "🎸 Teste — Lembrete de Escala",
        body: "Você está escalado hoje às 18:00 — Culto da Família · Função: Guitarra",
        url: "/dashboard/escalas",
        tag: "teste-escala",
      });
      return NextResponse.json({ ok: true, enviado: "somente_voce", subscriptions: count });
    }

    return NextResponse.json({ error: "tipo inválido. Use: aviso, evento, chat, escala" }, { status: 400 });
  } catch (err) {
    console.error("[push/test]", err);
    return NextResponse.json({ error: "Erro ao enviar notificação de teste" }, { status: 500 });
  }
}
