import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingSequenceColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes("sequence_id");
}

function isNewer(
  candidate: { id: string; criado_em: string | null; sequence_id: number | null },
  current: { id: string; criado_em: string | null; sequence_id: number | null } | null
) {
  if (!current) return true;
  const candidateSequence = candidate.sequence_id ?? 0;
  const currentSequence = current.sequence_id ?? 0;
  if (candidateSequence !== currentSequence) return candidateSequence > currentSequence;

  const candidateTime = candidate.criado_em ? new Date(candidate.criado_em).getTime() : 0;
  const currentTime = current.criado_em ? new Date(current.criado_em).getTime() : 0;
  if (candidateTime !== currentTime) return candidateTime > currentTime;

  return candidate.id > current.id;
}

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: participacoes, error: partErr } = await admin
    .from("chat_participantes")
    .select("conversa_id, historico_desde")
    .eq("user_id", user.id);

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });

  const historicoDesdeByConversa = new Map(
    (participacoes ?? []).map((p: { conversa_id: string; historico_desde?: string | null }) => [p.conversa_id, p.historico_desde ?? null])
  );
  const conversaIds = (participacoes ?? []).map((p: { conversa_id: string }) => p.conversa_id);
  if (!conversaIds.length) return NextResponse.json({ ok: true, total: 0, by_conversa: {} });

  const { data: cursors, error: cursorErr } = await admin
    .from("chat_participante_cursors")
    .select("conversa_id, last_read_message_id")
    .eq("user_id", user.id)
    .in("conversa_id", conversaIds);

  if (cursorErr) return NextResponse.json({ error: cursorErr.message }, { status: 500 });

  const readIds = (cursors ?? [])
    .map((c: { last_read_message_id: string | null }) => c.last_read_message_id)
    .filter(Boolean) as string[];

  const readMessageById = new Map<string, { id: string; criado_em: string | null; sequence_id: number | null }>();
  if (readIds.length) {
    let { data: readMessages, error: readErr } = await admin
      .from("chat_mensagens")
      .select("id, criado_em, sequence_id")
      .in("id", [...new Set(readIds)]);

    if (readErr && isMissingSequenceColumn(readErr)) {
      const fallbackRead = await admin
        .from("chat_mensagens")
        .select("id, criado_em")
        .in("id", [...new Set(readIds)]);
      readMessages = (fallbackRead.data ?? []).map((m: { id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
      readErr = fallbackRead.error;
    }

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    for (const message of readMessages ?? []) {
      readMessageById.set(message.id, { ...message, sequence_id: null });
    }
  }

  const cursorByConversation = new Map(
    (cursors ?? []).map((cursor: { conversa_id: string; last_read_message_id: string | null }) => [cursor.conversa_id, cursor])
  );

  let { data: messages, error: msgErr } = await admin
    .from("chat_mensagens")
    .select("id, conversa_id, autor_id, criado_em, sequence_id")
    .in("conversa_id", conversaIds)
    .neq("autor_id", user.id)
    .order("sequence_id", { ascending: true })
    .order("criado_em", { ascending: true })
    .limit(5000);

  if (msgErr && isMissingSequenceColumn(msgErr)) {
    const fallbackMessages = await admin
      .from("chat_mensagens")
      .select("id, conversa_id, autor_id, criado_em")
      .in("conversa_id", conversaIds)
      .neq("autor_id", user.id)
      .order("criado_em", { ascending: true })
      .limit(5000);
    messages = (fallbackMessages.data ?? []).map((m: { id: string; conversa_id: string; autor_id: string; criado_em: string | null }) => ({ ...m, sequence_id: null }));
    msgErr = fallbackMessages.error;
  }

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const byConversa: Record<string, number> = {};
  for (const message of messages ?? []) {
    const historicoDesde = historicoDesdeByConversa.get(message.conversa_id);
    if (historicoDesde && message.criado_em && new Date(message.criado_em).getTime() < new Date(historicoDesde).getTime()) {
      continue;
    }
    const cursor = cursorByConversation.get(message.conversa_id);
    const readMessage = cursor?.last_read_message_id
      ? readMessageById.get(cursor.last_read_message_id) ?? null
      : null;

    if (isNewer({ ...message, sequence_id: null }, readMessage)) {
      byConversa[message.conversa_id] = (byConversa[message.conversa_id] ?? 0) + 1;
    }
  }

  const total = Object.values(byConversa).reduce((sum, count) => sum + count, 0);
  return NextResponse.json({ ok: true, total, by_conversa: byConversa });
}
