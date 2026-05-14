import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/chat/ack
 * Body:
 *   { type: "delivered" | "read", messageIds?: string[], conversaId?: string }
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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

  const { type, messageIds, conversaId } = await req.json() as {
    type: "delivered" | "read";
    messageIds?: string[];
    conversaId?: string;
  };

  if (type !== "delivered" && type !== "read") {
    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  }

  let targetIds = (messageIds ?? []).filter(Boolean);

  if (conversaId && !targetIds.length) {
    const { data: msgs, error: msgErr } = await admin
      .from("chat_mensagens")
      .select("id")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: false })
      .limit(800);

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    targetIds = (msgs ?? []).map((m: { id: string }) => m.id);
  }

  if (!targetIds.length) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Garante existência das linhas de receipt para o usuário atual.
  const { error: upsertErr } = await admin
    .from("chat_message_receipts")
    .upsert(
      targetIds.map((id) => ({ message_id: id, user_id: user.id })),
      { onConflict: "message_id,user_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const patch = type === "read"
    ? { read_at: new Date().toISOString(), delivered_at: new Date().toISOString() }
    : { delivered_at: new Date().toISOString() };

  const { error: updateErr, data: updatedRows } = await admin
    .from("chat_message_receipts")
    .update(patch)
    .eq("user_id", user.id)
    .in("message_id", targetIds)
    .select("message_id");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: updatedRows?.length ?? 0 });
}
