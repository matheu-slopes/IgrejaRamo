import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/chat/sync?since=<iso>
 * Sincroniza mensagens recentes das conversas do usuário autenticado.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const since = req.nextUrl.searchParams.get("since");

  const { data: participacoes, error: partErr } = await admin
    .from("chat_participantes")
    .select("conversa_id")
    .eq("user_id", user.id);

  if (partErr) {
    return NextResponse.json({ error: partErr.message }, { status: 500 });
  }

  const conversaIds = (participacoes ?? []).map((p: { conversa_id: string }) => p.conversa_id);
  if (!conversaIds.length) {
    return NextResponse.json({ ok: true, conversa_ids: [], mensagens: [], max_criado_em: null });
  }

  let query = admin
    .from("chat_mensagens")
    .select("*")
    .in("conversa_id", conversaIds)
    .order("criado_em", { ascending: true })
    .limit(1500);

  if (since) {
    query = query.gte("criado_em", since);
  }

  const { data: mensagens, error: msgErr } = await query;
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Atualiza receipts de entrega para as mensagens recebidas por este usuário.
  try {
    const deliveredIds = (mensagens ?? [])
      .filter((m: { id: string; autor_id: string | null }) => m.autor_id && m.autor_id !== user.id)
      .map((m: { id: string }) => m.id);

    if (deliveredIds.length) {
      await admin
        .from("chat_message_receipts")
        .upsert(
          deliveredIds.map((id) => ({
            message_id: id,
            user_id: user.id,
            sent_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
          })),
          { onConflict: "message_id,user_id" }
        );

      await admin
        .from("chat_message_receipts")
        .update({ delivered_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("message_id", deliveredIds)
        .is("delivered_at", null);
    }
  } catch (receiptErr) {
    console.error("chat/sync receipt update error:", receiptErr);
  }

  const maxCriadoEm = mensagens?.length ? mensagens[mensagens.length - 1].criado_em : null;

  return NextResponse.json({
    ok: true,
    conversa_ids: conversaIds,
    mensagens: mensagens ?? [],
    max_criado_em: maxCriadoEm,
  });
}
