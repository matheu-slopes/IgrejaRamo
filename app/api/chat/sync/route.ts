import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ChatParticipacao = {
  conversa_id: string;
  historico_desde?: string | null;
  ocultado_em?: string | null;
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

function maxTimestamp(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[];
  if (!valid.length) return null;
  return valid.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  );
}

/**
 * GET /api/chat/sync?after_sequence=<n>
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

  const afterSequenceParam = req.nextUrl.searchParams.get("after_sequence");
  const parsedAfterSequence = afterSequenceParam ? Number(afterSequenceParam) : Number.NaN;
  const afterSequence = Number.isFinite(parsedAfterSequence) && parsedAfterSequence > 0
    ? parsedAfterSequence
    : null;
  const since = req.nextUrl.searchParams.get("since");

  const participacoesResult = await admin
    .from("chat_participantes")
    .select("conversa_id, historico_desde, ocultado_em")
    .eq("user_id", user.id);
  let participacoes = participacoesResult.data as ChatParticipacao[] | null;
  let partErr = participacoesResult.error;

  if (partErr && isMissingColumn(partErr, "ocultado_em")) {
    const fallback = await admin
      .from("chat_participantes")
      .select("conversa_id, historico_desde")
      .eq("user_id", user.id);
    participacoes = fallback.data?.map((p: { conversa_id: string; historico_desde?: string | null }) => ({ ...p, ocultado_em: null })) as ChatParticipacao[] | null;
    partErr = fallback.error;
  }

  if (partErr && isMissingColumn(partErr, "historico_desde")) {
    const fallback = await admin
      .from("chat_participantes")
      .select("conversa_id")
      .eq("user_id", user.id);
    participacoes = fallback.data?.map((p: { conversa_id: string }) => ({ ...p, historico_desde: null, ocultado_em: null })) as ChatParticipacao[] | null;
    partErr = fallback.error;
  }

  if (partErr) {
    return NextResponse.json({ error: partErr.message }, { status: 500 });
  }

  const historicoDesdeByConversa = new Map(
    (participacoes ?? []).map((p) => [
      p.conversa_id,
      maxTimestamp(p.historico_desde, p.ocultado_em),
    ])
  );
  const conversaIds = (participacoes ?? []).map((p: { conversa_id: string }) => p.conversa_id);
  if (!conversaIds.length) {
    return NextResponse.json({ ok: true, conversa_ids: [], mensagens: [], max_criado_em: null, max_sequence_id: null });
  }

  const hasSequence = { value: true };

  let query = admin
    .from("chat_mensagens")
    .select("*")
    .in("conversa_id", conversaIds)
    .order("sequence_id", { ascending: true })
    .order("criado_em", { ascending: true })
    .limit(1500);

  if (afterSequence !== null) {
    query = query.gt("sequence_id", afterSequence);
  } else if (since) {
    query = query.gte("criado_em", since);
  }

  let { data: mensagens, error: msgErr } = await query;
  if (msgErr && isMissingSequenceColumn(msgErr)) {
    hasSequence.value = false;
    let fallbackQuery = admin
      .from("chat_mensagens")
      .select("*")
      .in("conversa_id", conversaIds)
      .order("criado_em", { ascending: true })
      .limit(1500);

    if (since) {
      fallbackQuery = fallbackQuery.gte("criado_em", since);
    }

    const fallback = await fallbackQuery;
    mensagens = fallback.data ?? [];
    msgErr = fallback.error;
  }

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  mensagens = (mensagens ?? []).filter((message: { conversa_id: string; criado_em: string | null }) => {
    const historicoDesde = historicoDesdeByConversa.get(message.conversa_id);
    if (!historicoDesde || !message.criado_em) return true;
    return new Date(message.criado_em).getTime() >= new Date(historicoDesde).getTime();
  });

  // Atualiza apenas o cursor de entrega por conversa.
  try {
    const latestIncoming = pickLatestByConversation(
      (mensagens ?? []).filter((m: { id: string; conversa_id: string; autor_id: string | null; criado_em: string | null; sequence_id: number | null }) =>
        Boolean(m.autor_id) && m.autor_id !== user.id
      )
    );

    if (latestIncoming.length) {
      const { data: currentCursors, error: cursorErr } = await admin
        .from("chat_participante_cursors")
        .select("conversa_id, last_delivered_message_id")
        .eq("user_id", user.id)
        .in("conversa_id", latestIncoming.map((msg) => msg.conversa_id));

      if (cursorErr) {
        throw cursorErr;
      }

      const currentIds = (currentCursors ?? [])
        .map((cursor: { last_delivered_message_id: string | null }) => cursor.last_delivered_message_id)
        .filter(Boolean) as string[];

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
          throw currentMsgErr;
        }

        for (const message of currentMessages ?? []) {
          currentMessageById.set(message.id, message);
        }
      }

      const cursorByConversation = new Map(
        (currentCursors ?? []).map((cursor: { conversa_id: string; last_delivered_message_id: string | null }) => [cursor.conversa_id, cursor])
      );

      const now = new Date().toISOString();
      const upserts = latestIncoming.flatMap((message) => {
        const currentCursor = cursorByConversation.get(message.conversa_id);
        const currentMessage = currentCursor?.last_delivered_message_id
          ? currentMessageById.get(currentCursor.last_delivered_message_id) ?? null
          : null;

        if (!isMessageNewer(message, currentMessage)) {
          return [];
        }

        return [{
          conversa_id: message.conversa_id,
          user_id: user.id,
          last_delivered_message_id: message.id,
          last_delivered_at: now,
          updated_at: now,
        }];
      });

      if (upserts.length) {
        const { error: upsertErr } = await admin
          .from("chat_participante_cursors")
          .upsert(upserts, { onConflict: "conversa_id,user_id" });

        if (upsertErr) {
          throw upsertErr;
        }
      }
    }
  } catch (receiptErr) {
    console.error("chat/sync cursor update error:", receiptErr);
  }

  const maxCriadoEm = mensagens?.length ? mensagens[mensagens.length - 1].criado_em : null;
  const maxSequenceId = hasSequence.value && mensagens?.length ? mensagens[mensagens.length - 1].sequence_id ?? null : null;

  return NextResponse.json({
    ok: true,
    conversa_ids: conversaIds,
    mensagens: mensagens ?? [],
    max_criado_em: maxCriadoEm,
    max_sequence_id: maxSequenceId,
  });
}

function pickLatestByConversation(
  messages: Array<{ id: string; conversa_id: string; criado_em: string | null; sequence_id: number | null }>
) {
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
