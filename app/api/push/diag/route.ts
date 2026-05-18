import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fingerprint(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 10) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-6)} (len ${trimmed.length})`;
}

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user ?? null;
}

/**
 * GET /api/push/diag
 * Retorna fingerprint das chaves VAPID, contagem e hosts das subs do usuário
 * pra comparar com o que o cliente tem.
 */
export async function GET(req: NextRequest) {
  const user = await authUser(req);
  const serverPub = process.env.VAPID_PUBLIC_KEY ?? null;
  const clientPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const vapidMatch = !!serverPub && !!clientPub && serverPub.trim() === clientPub.trim();
  const vapidSubject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://igreja-ramo.vercel.app";

  const base = {
    vapid: {
      server_set: !!serverPub,
      client_set: !!clientPub,
      private_set: !!process.env.VAPID_PRIVATE_KEY,
      subject: vapidSubject,
      server_fingerprint: fingerprint(serverPub),
      client_fingerprint: fingerprint(clientPub),
      match: vapidMatch,
    },
    service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    autenticado: !!user,
  };

  if (!user) return NextResponse.json(base);

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, criado_em")
    .eq("user_id", user.id);

  const list = (subs ?? []) as { endpoint: string; criado_em: string }[];
  const detailed = list.map((s) => {
    let host = "endpoint_invalido";
    try { host = new URL(s.endpoint).host; } catch { /* ignore */ }
    return { host, criado_em: s.criado_em, endpoint_tail: s.endpoint.slice(-12) };
  });

  const { data: jobs, error: jobsErr } = await admin
    .from("chat_notification_jobs")
    .select("message_id, status, attempts, last_error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    ...base,
    user_id: user.id,
    minhas_subs_count: list.length,
    minhas_subs: detailed,
    fila: jobsErr
      ? { erro: jobsErr.message, dica: "Migration chat_notification_jobs provavelmente não aplicada" }
      : (jobs ?? []),
  });
}

/**
 * POST /api/push/diag
 * Envia um push de teste somente para as subs do próprio usuário e
 * devolve o resultado bruto (status, message) por sub.
 */
export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const delivery = await sendPushToUsers([user.id], {
    title: "🔔 Diagnóstico — push funcionando",
    body: `Recebido em ${new Date().toLocaleTimeString("pt-BR")}`,
    url: "/dashboard",
    tag: "diag-push",
  });

  return NextResponse.json({ ok: delivery.sent > 0, delivery });
}

/**
 * DELETE /api/push/diag
 * Remove TODAS as subs do usuário no servidor (útil pra forçar re-registro
 * quando a chave VAPID mudou ou as subs ficaram presas).
 */
export async function DELETE(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
