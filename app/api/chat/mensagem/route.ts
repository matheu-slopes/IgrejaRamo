import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";

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

  const { data: inserted, error } = await admin.from("chat_mensagens").insert({
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
  }).select("criado_em").single();

  if (error) {
    console.error("chat/mensagem insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Retorna o criado_em atribuído pelo servidor (NOW()) para o cliente usar no broadcast
  // Garante que a ordem das mensagens usa sempre o relógio do servidor, não do cliente

  // ── Push notification para os outros participantes ───────────────────────
  // Em ambiente serverless, fire-and-forget pode ser interrompido ao finalizar a request.
  try {
    await sendPushParticipantes(conversa_id, autor_id, autor_nome, conteudo, tipo);
  } catch (e) {
    console.error("push chat error:", e);
    // Não falha o envio da mensagem por erro de push.
  }

  return NextResponse.json({ ok: true, criado_em: inserted.criado_em });
}

/** Envia push para todos os participantes de uma conversa exceto o autor */
async function sendPushParticipantes(
  conversa_id: string,
  autor_id: string,
  autor_nome: string,
  conteudo: string,
  tipo: string
) {
  const { data: participantes } = await admin
    .from("chat_participantes")
    .select("user_id")
    .eq("conversa_id", conversa_id)
    .neq("user_id", autor_id);

  if (!participantes?.length) return;

  const userIds = participantes.map((p: { user_id: string }) => p.user_id);
  const nome = autor_nome?.split(" ")[0] ?? "Alguém";
  const body =
    tipo === "imagem"
      ? `${nome} enviou uma foto`
      : tipo === "audio"
      ? `${nome} enviou um áudio`
      : tipo === "arquivo"
      ? `${nome} enviou um arquivo`
      : `${nome}: ${conteudo?.slice(0, 80) ?? ""}`;

  await sendPushToUsers(userIds, {
    title: "💬 Nova mensagem",
    body,
    url: "/dashboard/chat",
    tag: `chat-${conversa_id}`,
  });
}
