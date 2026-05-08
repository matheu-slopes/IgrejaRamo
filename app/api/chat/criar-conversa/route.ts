import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tipo, nome, emoji, cor, descricao, admin_id, somente_admin, participantes } = body;

  // Cria a conversa
  const insertData: Record<string, unknown> = { tipo };
  if (nome) insertData.nome = nome;
  if (emoji) insertData.emoji = emoji;
  if (cor) insertData.cor = cor;
  if (descricao) insertData.descricao = descricao;
  if (admin_id) insertData.admin_id = admin_id;
  if (somente_admin !== undefined) insertData.somente_admin = somente_admin;

  const { data: conversa, error: errConv } = await admin
    .from("chat_conversas")
    .insert(insertData)
    .select("id")
    .single();

  if (errConv || !conversa) {
    console.error("criar-conversa error:", errConv);
    return NextResponse.json({ error: errConv?.message ?? "Erro ao criar conversa" }, { status: 500 });
  }

  const cid = (conversa as { id: string }).id;

  // Insere participantes
  if (participantes?.length) {
    const { error: errPart } = await admin
      .from("chat_participantes")
      .insert(participantes.map((uid: string) => ({ conversa_id: cid, user_id: uid })));
    if (errPart) {
      console.error("criar-conversa participantes error:", errPart);
      return NextResponse.json({ error: errPart.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: cid });
}
