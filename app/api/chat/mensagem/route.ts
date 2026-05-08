import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verifica autenticação via Bearer token
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Valida o JWT do usuário usando o client admin
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
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

  const { error } = await admin.from("chat_mensagens").insert({
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
  });

  if (error) {
    console.error("chat/mensagem insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
