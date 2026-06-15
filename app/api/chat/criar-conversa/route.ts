import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tipo, nome, emoji, avatar_url, cor, descricao, admin_id, somente_admin, participantes } = body;

  // Para conversas diretas, verifica se já existe uma entre os mesmos participantes
  if (tipo === "direto" && participantes?.length === 2) {
    const [p1, p2] = participantes as string[];
    const { data: existing } = await admin
      .from("chat_participantes")
      .select("conversa_id")
      .eq("user_id", p1);
    if (existing?.length) {
      const ids = existing.map((e: { conversa_id: string }) => e.conversa_id);
      const { data: shared } = await admin
        .from("chat_participantes")
        .select("conversa_id")
        .eq("user_id", p2)
        .in("conversa_id", ids);
      if (shared?.length) {
        // Verifica se a conversa existente é do tipo "direto"
        const sharedId = (shared[0] as { conversa_id: string }).conversa_id;
        const { data: conv } = await admin
          .from("chat_conversas")
          .select("id, tipo")
          .eq("id", sharedId)
          .eq("tipo", "direto")
          .single();
        if (conv) return NextResponse.json({ id: (conv as { id: string }).id });
      }
    }
  }

  // Cria a conversa
  const insertData: Record<string, unknown> = { tipo };
  if (nome) insertData.nome = nome;
  if (emoji) insertData.emoji = emoji;
  if (avatar_url) insertData.avatar_url = avatar_url;
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
