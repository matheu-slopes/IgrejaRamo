import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { dispatchChatNotificationNow, enqueueChatNotificationJob, processChatNotificationJob } from "@/lib/chatNotifications";
import { authenticatedChatUser, chatWriteAccess, isChatMember } from "@/lib/chatServerAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingSequenceColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes("sequence_id");
}

export async function POST(req: NextRequest) {
  const user = await authenticatedChatUser(req, admin);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    id,
    conversa_id,
    autor_id,
    conteudo,
    tipo,
    media_url,
    resposta_a_id,
  } = body;

  // Garante que o autor_id bate com o usuário autenticado
  if (autor_id !== user.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!id || !conversa_id || !autor_id || (!conteudo && !media_url)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const access = await chatWriteAccess(admin, conversa_id, user.id);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });

  const allowedTypes = new Set(["texto", "imagem", "audio", "documento", "arquivo"]);
  if (!allowedTypes.has(tipo ?? "texto")) return NextResponse.json({ error: "Tipo de mensagem inválido" }, { status: 400 });
  if (String(conteudo ?? "").length > 10_000) return NextResponse.json({ error: "Mensagem muito longa" }, { status: 413 });

  const { data: authorProfile } = await admin.from("perfis").select("nome").eq("id", user.id).maybeSingle();
  const safeAuthorName = authorProfile?.nome ?? user.user_metadata?.nome ?? "Usuário";
  let safeReply: { id: string; autor_nome: string; conteudo: string } | null = null;
  if (resposta_a_id) {
    const { data: reply } = await admin
      .from("chat_mensagens")
      .select("id, autor_nome, conteudo")
      .eq("id", resposta_a_id)
      .eq("conversa_id", conversa_id)
      .maybeSingle();
    if (!reply) return NextResponse.json({ error: "Mensagem respondida não encontrada" }, { status: 400 });
    safeReply = reply;
  }

  const insertPayload = {
    id,
    conversa_id,
    autor_id,
    autor_nome: safeAuthorName,
    conteudo: conteudo ?? "",
    tipo: tipo ?? "texto",
    media_url: media_url ?? null,
    resposta_a_id: safeReply?.id ?? null,
    resposta_a_autor_nome: safeReply?.autor_nome ?? null,
    resposta_a_conteudo: safeReply?.conteudo?.slice(0, 500) ?? null,
  };

  let criadoEm: string | null = null;
  let sequenceId: number | null = null;
  let { data: inserted, error } = await admin
    .from("chat_mensagens")
    .insert(insertPayload)
    .select("criado_em, sequence_id")
    .single();

  if (error && isMissingSequenceColumn(error)) {
    const fallback = await admin
      .from("chat_mensagens")
      .insert(insertPayload)
      .select("criado_em")
      .single();

    inserted = fallback.data ? { ...fallback.data, sequence_id: null } : null;
    error = fallback.error;
  }

  if (error) {
    // Reenvio da mesma mensagem (mesmo UUID) em rede instável: trata como idempotente.
    if ((error as { code?: string }).code === "23505") {
      let { data: existing, error: existingErr } = await admin
        .from("chat_mensagens")
        .select("criado_em, sequence_id")
        .eq("id", id)
        .single();

      if (existingErr && isMissingSequenceColumn(existingErr)) {
        const fallbackExisting = await admin
          .from("chat_mensagens")
          .select("criado_em")
          .eq("id", id)
          .single();

        existing = fallbackExisting.data ? { ...fallbackExisting.data, sequence_id: null } : null;
        existingErr = fallbackExisting.error;
      }

      if (existingErr || !existing?.criado_em) {
        console.error("chat/mensagem duplicate fetch error:", existingErr);
        return NextResponse.json({ error: existingErr?.message ?? "Falha ao recuperar mensagem" }, { status: 500 });
      }

      criadoEm = existing.criado_em;
      sequenceId = existing.sequence_id ?? null;
    } else {
      console.error("chat/mensagem insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    if (!inserted?.criado_em) {
      return NextResponse.json({ error: "Falha ao recuperar mensagem enviada" }, { status: 500 });
    }
    criadoEm = inserted.criado_em;
    sequenceId = inserted.sequence_id ?? null;
  }

  try {
    await touchAuthorCursor(id, conversa_id, autor_id, criadoEm);
  } catch (e) {
    console.error("chat author cursor upsert error:", e);
  }

  // Retorna o criado_em atribuído pelo servidor (NOW()) para o cliente usar no broadcast
  // Garante que a ordem das mensagens usa sempre o relógio do servidor, não do cliente

  // Push/sino ficam fora do caminho crítico para a mensagem aparecer rápido.
  const notificationJob = {
    message_id: id,
    conversa_id,
    autor_id,
    autor_nome: safeAuthorName,
    conteudo: conteudo ?? "",
    tipo: tipo ?? "texto",
  };

  // Enfileira + processa notificação fora do caminho crítico (fire-and-forget).
  // O GitHub Actions (chat-dispatch-notifications.yml) cobre casos não processados em até 5 min.
  after(async () => {
    try {
      await enqueueChatNotificationJob(notificationJob);
      await processChatNotificationJob(id);
    } catch (e) {
      console.error("chat notification enqueue/dispatch error:", e);
      if (isMissingQueueTable(e)) {
        try {
          await dispatchChatNotificationNow(notificationJob);
        } catch (fallbackErr) {
          console.error("chat notification direct fallback error:", fallbackErr);
        }
      }
    }
  });

  return NextResponse.json({ ok: true, criado_em: criadoEm, sequence_id: sequenceId });
}

export async function PATCH(req: NextRequest) {
  const user = await authenticatedChatUser(req, admin);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null) as { id?: string; action?: "edit" | "reactions"; conteudo?: string; reacoes?: unknown } | null;
  if (!body?.id) return NextResponse.json({ error: "Mensagem não informada" }, { status: 400 });

  const { data: message, error } = await admin
    .from("chat_mensagens")
    .select("id, conversa_id, autor_id")
    .eq("id", body.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!message || !(await isChatMember(admin, message.conversa_id, user.id))) {
    return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  if (body.action === "edit") {
    if (message.autor_id !== user.id) return NextResponse.json({ error: "Você só pode editar suas mensagens" }, { status: 403 });
    const text = String(body.conteudo ?? "").trim();
    if (!text || text.length > 10_000) return NextResponse.json({ error: "Conteúdo inválido" }, { status: 400 });
    payload = { conteudo: text, editado_em: new Date().toISOString() };
  } else if (body.action === "reactions" && Array.isArray(body.reacoes)) {
    const valid = body.reacoes.length <= 20 && body.reacoes.every((reaction) => {
      if (!reaction || typeof reaction !== "object") return false;
      const item = reaction as { emoji?: unknown; count?: unknown };
      return typeof item.emoji === "string" && item.emoji.length <= 16 &&
        Number.isInteger(item.count) && Number(item.count) >= 1 && Number(item.count) <= 10_000;
    });
    if (!valid) return NextResponse.json({ error: "Reações inválidas" }, { status: 400 });
    payload = { reacoes: body.reacoes };
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const { error: updateError } = await admin.from("chat_mensagens").update(payload).eq("id", body.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function isMissingQueueTable(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === "42P01" || String(err?.message ?? "").includes("chat_notification_jobs");
}

async function touchAuthorCursor(
  mensagem_id: string,
  conversa_id: string,
  autor_id: string,
  criadoEm: string | null
) {
  const now = criadoEm ?? new Date().toISOString();

  const { error } = await admin
    .from("chat_participante_cursors")
    .upsert(
      {
        conversa_id,
        user_id: autor_id,
        last_delivered_message_id: mensagem_id,
        last_delivered_at: now,
        last_read_message_id: mensagem_id,
        last_read_at: now,
        updated_at: now,
      },
      { onConflict: "conversa_id,user_id" }
    );

  if (error) throw error;
}
