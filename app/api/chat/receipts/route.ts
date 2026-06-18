import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MessageCursor = {
  id: string;
  conversa_id: string;
  criado_em: string | null;
  sequence_id: number | null;
};

function isMissingSequenceColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes("sequence_id");
}

function isMissingColumn(error: unknown, column: string) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  const col = column.toLowerCase();
  return (
    (err?.code === "42703" && msg.includes(col)) ||
    (msg.includes(col) && msg.includes("schema cache"))
  );
}

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversaIds: string[] = Array.isArray(body.conversa_ids)
    ? Array.from(new Set<string>(body.conversa_ids.filter((id: unknown): id is string => typeof id === "string" && Boolean(id))))
    : [];

  if (!conversaIds.length) {
    return NextResponse.json({ ok: true, conversas: {} });
  }

  const { data: minhasParticipacoes, error: minhasErr } = await admin
    .from("chat_participantes")
    .select("conversa_id")
    .eq("user_id", user.id)
    .in("conversa_id", conversaIds);

  if (minhasErr) {
    return NextResponse.json({ error: minhasErr.message }, { status: 500 });
  }

  const allowedIds = (minhasParticipacoes ?? []).map((p: { conversa_id: string }) => p.conversa_id);
  if (!allowedIds.length) {
    return NextResponse.json({ ok: true, conversas: {} });
  }

  const participantesResult = await admin
    .from("chat_participantes")
    .select("conversa_id, user_id, historico_desde")
    .in("conversa_id", allowedIds);
  let participantes = participantesResult.data as Array<{ conversa_id: string; user_id: string; historico_desde?: string | null }> | null;
  let partErr = participantesResult.error;

  if (partErr && isMissingColumn(partErr, "historico_desde")) {
    const fallback = await admin
      .from("chat_participantes")
      .select("conversa_id, user_id")
      .in("conversa_id", allowedIds);
    participantes = fallback.data?.map((p: { conversa_id: string; user_id: string }) => ({ ...p, historico_desde: null })) ?? null;
    partErr = fallback.error;
  }

  const { data: cursors, error: cursorErr } = await admin
      .from("chat_participante_cursors")
      .select("conversa_id, user_id, last_delivered_message_id, last_read_message_id")
      .in("conversa_id", allowedIds);

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });
  if (cursorErr) return NextResponse.json({ error: cursorErr.message }, { status: 500 });

  const cursorMessageIds = [
    ...(cursors ?? []).map((c: { last_delivered_message_id: string | null }) => c.last_delivered_message_id),
    ...(cursors ?? []).map((c: { last_read_message_id: string | null }) => c.last_read_message_id),
  ].filter(Boolean) as string[];

  const messageById = new Map<string, MessageCursor>();
  if (cursorMessageIds.length) {
    let { data: messages, error: msgErr } = await admin
      .from("chat_mensagens")
      .select("id, conversa_id, criado_em, sequence_id")
      .in("id", [...new Set(cursorMessageIds)]);

    if (msgErr && isMissingSequenceColumn(msgErr)) {
      const fallback = await admin
        .from("chat_mensagens")
        .select("id, conversa_id, criado_em")
        .in("id", [...new Set(cursorMessageIds)]);
      messages = (fallback.data ?? []).map((m: { id: string; conversa_id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
      msgErr = fallback.error;
    }

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    for (const message of (messages ?? []) as MessageCursor[]) {
      messageById.set(message.id, message);
    }
  }

  const response: Record<string, {
    participantIds: string[];
    participants: Array<{ userId: string; historicoDesde: string | null }>;
    cursors: Array<{
      userId: string;
      delivered: MessageCursor | null;
      read: MessageCursor | null;
    }>;
  }> = {};

  for (const conversaId of allowedIds) {
    response[conversaId] = { participantIds: [], participants: [], cursors: [] };
  }

  for (const participante of (participantes ?? []) as Array<{ conversa_id: string; user_id: string; historico_desde?: string | null }>) {
    response[participante.conversa_id]?.participantIds.push(participante.user_id);
    response[participante.conversa_id]?.participants.push({
      userId: participante.user_id,
      historicoDesde: participante.historico_desde ?? null,
    });
  }

  for (const cursor of (cursors ?? []) as Array<{
    conversa_id: string;
    user_id: string;
    last_delivered_message_id: string | null;
    last_read_message_id: string | null;
  }>) {
    response[cursor.conversa_id]?.cursors.push({
      userId: cursor.user_id,
      delivered: cursor.last_delivered_message_id ? messageById.get(cursor.last_delivered_message_id) ?? null : null,
      read: cursor.last_read_message_id ? messageById.get(cursor.last_read_message_id) ?? null : null,
    });
  }

  return NextResponse.json({ ok: true, conversas: response });
}
