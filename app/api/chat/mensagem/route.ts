import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueChatNotificationJob } from "@/lib/chatNotifications";

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
  try {
    await enqueueChatNotificationJob({
      message_id: id,
      conversa_id,
      autor_id,
      autor_nome,
      conteudo: conteudo ?? "",
      tipo: tipo ?? "texto",
    });
  } catch (e) {
    console.error("chat notification enqueue error:", e);
    // Não falha o envio da mensagem por erro de fila/notificação.
  }

  return NextResponse.json({ ok: true, criado_em: criadoEm, sequence_id: sequenceId });
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
