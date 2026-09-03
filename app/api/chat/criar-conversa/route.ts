import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticatedChatUser } from "@/lib/chatServerAuth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingColumn(error: unknown, column: string) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  const col = column.toLowerCase();
  return (
    (err?.code === "42703" && msg.includes(col)) ||
    (msg.includes(col) && msg.includes("schema cache"))
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticatedChatUser(req, admin);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { tipo, nome, emoji, avatar_url, cor, descricao, somente_admin, participantes } = body;
  const participantIds = [...new Set((Array.isArray(participantes) ? participantes : []).filter((id: unknown): id is string => typeof id === "string" && id.length > 0))];

  if (tipo !== "direto" && tipo !== "grupo") return NextResponse.json({ error: "Tipo de conversa inválido" }, { status: 400 });
  if (!participantIds.includes(user.id)) return NextResponse.json({ error: "Você precisa participar da conversa" }, { status: 403 });
  if (tipo === "direto" && (participantIds.length !== 2 || participantIds[0] === participantIds[1])) {
    return NextResponse.json({ error: "Conversa direta precisa de dois participantes" }, { status: 400 });
  }
  if (tipo === "grupo" && (!String(nome ?? "").trim() || participantIds.length < 1)) {
    return NextResponse.json({ error: "Informe o nome e os participantes do grupo" }, { status: 400 });
  }
  if (participantIds.length > 200 || String(nome ?? "").length > 100 || String(descricao ?? "").length > 500) {
    return NextResponse.json({ error: "Limite do grupo excedido" }, { status: 413 });
  }

  // Para conversas diretas, verifica se já existe uma entre os mesmos participantes
  if (tipo === "direto") {
    const [p1, p2] = participantIds;
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
        if (conv) {
          const { error: unhideErr } = await admin
            .from("chat_participantes")
            .update({ ocultado_em: null })
            .eq("conversa_id", (conv as { id: string }).id)
            .eq("user_id", user.id);
          if (unhideErr && !isMissingColumn(unhideErr, "ocultado_em")) {
            return NextResponse.json({ error: unhideErr.message }, { status: 500 });
          }
          return NextResponse.json({ id: (conv as { id: string }).id });
        }
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
  if (tipo === "grupo") insertData.admin_id = user.id;
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
  if (participantIds.length) {
    const { error: errPart } = await admin
      .from("chat_participantes")
      .insert(participantIds.map((uid: string) => ({ conversa_id: cid, user_id: uid })));
    if (errPart) {
      console.error("criar-conversa participantes error:", errPart);
      await admin.from("chat_conversas").delete().eq("id", cid);
      return NextResponse.json({ error: errPart.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: cid });
}
