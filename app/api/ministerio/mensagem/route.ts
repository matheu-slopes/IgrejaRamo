import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PushDispatchResult, sendPushToUsers } from "@/lib/sendPush";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  // Autenticação via Bearer token
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const body = await req.json();
  const { id: clientId, ministerio, autor_id, autor_nome, autor_role, conteudo, tipo, media_url, resposta_a } = body;

  if (autor_id !== user.id) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!ministerio || !autor_id || (!conteudo && !media_url)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    ministerio, autor_id, autor_nome, autor_role, conteudo, tipo: tipo ?? "texto",
    media_url: media_url ?? null, fixada: false, resposta_a: resposta_a ?? null,
  };
  // Aceita UUID gerado pelo cliente (idempotência e deduplicação)
  if (clientId) insertData.id = clientId;

  let inserted: { id: string; criado_em: string } | null = null;
  const { data, error: insertError } = await admin
    .from("mural_mensagens")
    .insert(insertData)
    .select("id, criado_em")
    .single();

  if (insertError) {
    // Idempotência: mesmo UUID já foi inserido (retry de rede)
    if ((insertError as { code?: string }).code === "23505" && clientId) {
      const { data: existing } = await admin
        .from("mural_mensagens")
        .select("id, criado_em")
        .eq("id", clientId)
        .single();
      if (existing) {
        inserted = existing as { id: string; criado_em: string };
      } else {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      console.error("ministerio/mensagem insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  } else {
    inserted = data as { id: string; criado_em: string };
  }

  if (!inserted) return NextResponse.json({ error: "Falha ao inserir mensagem" }, { status: 500 });

  // Fire-and-forget: push + sininho para os membros do ministério (exceto o autor)
  sendPushMembros(ministerio, autor_id, autor_nome, conteudo, tipo).catch((e) =>
    console.error("ministerio push error:", e)
  );

  return NextResponse.json({ ok: true, id: inserted.id, criado_em: inserted.criado_em });
}

async function sendPushMembros(
  ministerio: string,
  autor_id: string,
  autor_nome: string,
  conteudo: string,
  tipo: string
) {
  // Busca todos os membros do ministério exceto o autor
  const { data: membros, error: membrosErr } = await admin
    .from("membros_ministerio")
    .select("usuario_id")
    .eq("ministerio", ministerio)
    .neq("usuario_id", autor_id);

  if (membrosErr) {
    console.error("membros_ministerio select error:", membrosErr);
    return;
  }

  // Inclui também admins/pastores que não são membros explícitos do ministério
  const { data: admins } = await admin
    .from("perfis")
    .select("id")
    .in("role", ["admin", "pastor"])
    .neq("id", autor_id);

  const membroIds = [...new Set([
    ...(membros ?? []).map((m: { usuario_id: string }) => m.usuario_id),
    ...(admins ?? []).map((a: { id: string }) => a.id),
  ].filter(Boolean))];

  if (!membroIds.length) return;

  const nome = autor_nome?.split(" ")[0] ?? "Alguém";
  const body =
    tipo === "imagem" ? `${nome} enviou uma foto` :
    tipo === "audio"  ? `${nome} enviou um áudio` :
    tipo === "arquivo"? `${nome} enviou um arquivo` :
    `${nome}: ${conteudo?.slice(0, 80) ?? ""}`;

  const title = `💬 ${ministerio}`;
  const url = `/dashboard/ministerio/${encodeURIComponent(ministerio)}`;

  let delivery: PushDispatchResult | null = null;
  try {
    delivery = await sendPushToUsers(membroIds, { title, body, url, tag: `ministerio-${ministerio}-${Date.now()}` });
    if (delivery.sent === 0) {
      console.warn("ministerio push zero sent:", { ministerio, destinatarios: membroIds.length });
    }
  } catch (e) {
    console.error("ministerio push dispatch error:", e);
  }

  // Alimenta o sininho de notificações no app
  const notificacoes = membroIds.map((uid) => ({
    usuario_id: uid,
    titulo: title,
    corpo: body,
    tipo: "ministerio",
    link: url,
  }));

  const { error: notifError } = await admin.from("notificacoes").insert(notificacoes);
  if (notifError) console.error("ministerio notificacoes insert error:", notifError);
}
