import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PushDispatchResult, sendPushToUsers } from "@/lib/sendPush";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verifica autenticação via Bearer token
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Valida o JWT com um client de usuário (anon + Authorization Bearer)
  // para evitar falso 401 quando há diferença entre configs server/client.
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

  const body = await req.json();
  const {
    id,
    conversa_id,
    autor_id,
    autor_nome,
    conteudo,
    tipo,
    media_url,
    resposta_a_id,
    resposta_a_autor_nome,
    resposta_a_conteudo,
  } = body;

  // Garante que o autor_id bate com o usuário autenticado
  if (autor_id !== user.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!id || !conversa_id || !autor_id || (!conteudo && !media_url)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const insertPayload = {
    id,
    conversa_id,
    autor_id,
    autor_nome,
    conteudo: conteudo ?? "",
    tipo: tipo ?? "texto",
    media_url: media_url ?? null,
    resposta_a_id: resposta_a_id ?? null,
    resposta_a_autor_nome: resposta_a_autor_nome ?? null,
    resposta_a_conteudo: resposta_a_conteudo ?? null,
  };

  let criadoEm: string | null = null;
  let sequenceId: number | null = null;
  const { data: inserted, error } = await admin
    .from("chat_mensagens")
    .insert(insertPayload)
    .select("criado_em, sequence_id")
    .single();

  if (error) {
    // Reenvio da mesma mensagem (mesmo UUID) em rede instável: trata como idempotente.
    if ((error as { code?: string }).code === "23505") {
      const { data: existing, error: existingErr } = await admin
        .from("chat_mensagens")
        .select("criado_em, sequence_id")
        .eq("id", id)
        .single();

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

  // ── Push notification para os outros participantes ───────────────────────
  // Em ambiente serverless, fire-and-forget pode ser interrompido ao finalizar a request.
  try {
    await sendPushParticipantes(id, conversa_id, autor_id, autor_nome, conteudo, tipo);
  } catch (e) {
    console.error("push chat error:", e);
    // Não falha o envio da mensagem por erro de push.
  }

  return NextResponse.json({ ok: true, criado_em: criadoEm, sequence_id: sequenceId });
}

/** Envia push para todos os participantes de uma conversa exceto o autor */
async function sendPushParticipantes(
  mensagem_id: string,
  conversa_id: string,
  autor_id: string,
  autor_nome: string,
  conteudo: string,
  tipo: string
) {
  const userIds = await resolveRecipientIds(conversa_id, autor_id);
  if (!userIds.length) {
    console.warn("chat push sem destinatario:", { conversa_id, autor_id });
    return;
  }

  const nome = autor_nome?.split(" ")[0] ?? "Alguém";
  const body =
    tipo === "imagem"
      ? `${nome} enviou uma foto`
      : tipo === "audio"
      ? `${nome} enviou um áudio`
      : tipo === "arquivo"
      ? `${nome} enviou um arquivo`
      : `${nome}: ${conteudo?.slice(0, 80) ?? ""}`;

  let delivery: PushDispatchResult | null = null;
  try {
    delivery = await sendPushToUsers(userIds, {
      title: "💬 Nova mensagem",
      body,
      url: "/dashboard/chat",
      // Tag única por mensagem evita colapso/supressão de notificações em sequência.
      tag: `chat-${conversa_id}-${mensagem_id}`,
    });
    if (delivery.sent === 0) {
      console.warn("chat push zero sent:", {
        conversa_id,
        destinatarios: userIds.length,
        attempted: delivery.attempted,
        failed: delivery.failed,
        sampleError: delivery.errors[0]?.message ?? null,
      });
    }
  } catch (pushErr) {
    console.error("chat push dispatch error:", pushErr);
  }

  // Alimenta o sino de notificações no app (desktop/mobile) com a mesma mensagem.
  const notificacoes = userIds.map((uid) => ({
    usuario_id: uid,
    titulo: "💬 Nova mensagem",
    corpo: body,
    tipo: "ministerio",
    link: "/dashboard/chat",
  }));

  const { error: notifError } = await admin.from("notificacoes").insert(notificacoes);
  if (notifError) {
    console.error("chat notificacoes insert error:", notifError);
  }
}

async function resolveRecipientIds(conversa_id: string, autor_id: string): Promise<string[]> {
  // Caminho principal: participantes da conversa.
  const { data: participantes, error: partErr } = await admin
    .from("chat_participantes")
    .select("user_id")
    .eq("conversa_id", conversa_id)
    .neq("user_id", autor_id);

  if (partErr) {
    console.error("chat_participantes select error:", partErr);
  }

  const directIds = [...new Set((participantes ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean))];
  if (directIds.length) return directIds;

  // Fallback: usa autores recentes da conversa (auto-recuperação quando participantes está incompleto).
  const { data: historico, error: histErr } = await admin
    .from("chat_mensagens")
    .select("autor_id")
    .eq("conversa_id", conversa_id)
    .neq("autor_id", autor_id)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (histErr) {
    console.error("chat_mensagens fallback error:", histErr);
    return [];
  }

  const fallbackIds = [...new Set((historico ?? []).map((m: { autor_id: string }) => m.autor_id).filter(Boolean))];
  if (!fallbackIds.length) return [];

  // Tenta autocorrigir chat_participantes para próximos envios.
  try {
    const { data: existentes } = await admin
      .from("chat_participantes")
      .select("user_id")
      .eq("conversa_id", conversa_id)
      .in("user_id", fallbackIds);

    const existingSet = new Set((existentes ?? []).map((p: { user_id: string }) => p.user_id));
    const faltantes = fallbackIds.filter((id) => !existingSet.has(id));

    if (faltantes.length) {
      await admin.from("chat_participantes").insert(
        faltantes.map((uid) => ({ conversa_id, user_id: uid }))
      );
    }
  } catch (e) {
    console.error("chat_participantes heal error:", e);
  }

  return fallbackIds;
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
