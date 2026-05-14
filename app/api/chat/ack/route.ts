import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingSequenceColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes("sequence_id");
}

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

  let targetMessages: Array<{ id: string; conversa_id: string; criado_em: string | null; sequence_id: number | null }> = [];

  if (conversaId) {
    const { data: membership, error: memberErr } = await admin
      .from("chat_participantes")
      .select("conversa_id")
      .eq("conversa_id", conversaId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    let { data: latest, error: latestErr } = await admin
      .from("chat_mensagens")
      .select("id, conversa_id, criado_em, sequence_id")
      .eq("conversa_id", conversaId)
      .order("sequence_id", { ascending: false })
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (latestErr && isMissingSequenceColumn(latestErr)) {
      const fallbackLatest = await admin
        .from("chat_mensagens")
        .select("id, conversa_id, criado_em")
        .eq("conversa_id", conversaId)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);
      latest = (fallbackLatest.data ?? []).map((m: { id: string; conversa_id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
      latestErr = fallbackLatest.error;
    }

    if (latestErr) {
      return NextResponse.json({ error: latestErr.message }, { status: 500 });
    }

    targetMessages = latest ?? [];
  } else {
    const targetIds = (messageIds ?? []).filter(Boolean);
    if (!targetIds.length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    let { data: msgs, error: msgErr } = await admin
      .from("chat_mensagens")
      .select("id, conversa_id, criado_em, sequence_id")
      .in("id", targetIds);

    if (msgErr && isMissingSequenceColumn(msgErr)) {
      const fallbackMsgs = await admin
        .from("chat_mensagens")
        .select("id, conversa_id, criado_em")
        .in("id", targetIds);
      msgs = (fallbackMsgs.data ?? []).map((m: { id: string; conversa_id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
      msgErr = fallbackMsgs.error;
    }

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const conversaIds = [...new Set((msgs ?? []).map((msg) => msg.conversa_id).filter(Boolean))];
    if (!conversaIds.length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const { data: memberships, error: membershipsErr } = await admin
      .from("chat_participantes")
      .select("conversa_id")
      .eq("user_id", user.id)
      .in("conversa_id", conversaIds);

    if (membershipsErr) {
      return NextResponse.json({ error: membershipsErr.message }, { status: 500 });
    }

    const allowed = new Set((memberships ?? []).map((item: { conversa_id: string }) => item.conversa_id));
    targetMessages = pickLatestByConversation((msgs ?? []).filter((msg) => allowed.has(msg.conversa_id)));
  }

  if (!targetMessages.length) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { data: currentCursors, error: cursorErr } = await admin
    .from("chat_participante_cursors")
    .select("conversa_id, last_delivered_message_id, last_read_message_id")
    .eq("user_id", user.id)
    .in("conversa_id", targetMessages.map((msg) => msg.conversa_id));

  if (cursorErr) {
    return NextResponse.json({ error: cursorErr.message }, { status: 500 });
  }

  const currentByConversation = new Map(
    (currentCursors ?? []).map((cursor: { conversa_id: string; last_delivered_message_id: string | null; last_read_message_id: string | null }) => [cursor.conversa_id, cursor])
  );

  const currentIds = [
    ...(currentCursors ?? []).map((cursor: { last_delivered_message_id: string | null }) => cursor.last_delivered_message_id),
    ...(currentCursors ?? []).map((cursor: { last_read_message_id: string | null }) => cursor.last_read_message_id),
  ].filter(Boolean) as string[];

  const currentMessageById = new Map<string, { id: string; criado_em: string | null; sequence_id: number | null }>();
  if (currentIds.length) {
    let { data: currentMessages, error: currentMsgErr } = await admin
      .from("chat_mensagens")
      .select("id, criado_em, sequence_id")
      .in("id", [...new Set(currentIds)]);

    if (currentMsgErr && isMissingSequenceColumn(currentMsgErr)) {
      const fallbackCurrent = await admin
        .from("chat_mensagens")
        .select("id, criado_em")
        .in("id", [...new Set(currentIds)]);
      currentMessages = (fallbackCurrent.data ?? []).map((m: { id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
      currentMsgErr = fallbackCurrent.error;
    }

    if (currentMsgErr) {
      return NextResponse.json({ error: currentMsgErr.message }, { status: 500 });
    }

    for (const msg of currentMessages ?? []) {
      currentMessageById.set(msg.id, msg);
    }
  }

  const now = new Date().toISOString();
  const upserts = targetMessages.flatMap((message) => {
    const current = currentByConversation.get(message.conversa_id);
    const currentDelivered = current?.last_delivered_message_id ? currentMessageById.get(current.last_delivered_message_id) ?? null : null;
    const currentRead = current?.last_read_message_id ? currentMessageById.get(current.last_read_message_id) ?? null : null;
    const shouldAdvanceDelivered = isMessageNewer(message, currentDelivered);
    const shouldAdvanceRead = type === "read" ? isMessageNewer(message, currentRead) : false;

    if (!shouldAdvanceDelivered && !shouldAdvanceRead) {
      return [];
    }

    return [{
      conversa_id: message.conversa_id,
      user_id: user.id,
      ...(shouldAdvanceDelivered
        ? {
            last_delivered_message_id: message.id,
            last_delivered_at: now,
          }
        : {}),
      ...(shouldAdvanceRead
        ? {
            last_read_message_id: message.id,
            last_read_at: now,
          }
        : {}),
      updated_at: now,
    }];
  });

  if (!upserts.length) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error: upsertErr } = await admin
    .from("chat_participante_cursors")
    .upsert(upserts, { onConflict: "conversa_id,user_id" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: upserts.length });
}

function pickLatestByConversation(messages: Array<{ id: string; conversa_id: string; criado_em: string | null; sequence_id: number | null }>) {
  const byConversation = new Map<string, { id: string; conversa_id: string; criado_em: string | null; sequence_id: number | null }>();

  for (const message of messages) {
    const current = byConversation.get(message.conversa_id);
    if (!current || isMessageNewer(message, current)) {
      byConversation.set(message.conversa_id, message);
    }
  }

  return Array.from(byConversation.values());
}

function isMessageNewer(
  candidate: { id: string; criado_em: string | null; sequence_id: number | null },
  current: { id: string; criado_em: string | null; sequence_id: number | null } | null
) {
  if (!current) return true;

  const candidateSequence = candidate.sequence_id ?? 0;
  const currentSequence = current.sequence_id ?? 0;

  if (candidateSequence !== currentSequence) {
    return candidateSequence > currentSequence;
  }

  const candidateTime = candidate.criado_em ? new Date(candidate.criado_em).getTime() : 0;
  const currentTime = current.criado_em ? new Date(current.criado_em).getTime() : 0;

  if (candidateTime !== currentTime) {
    return candidateTime > currentTime;
  }

  return candidate.id > current.id;
}
