import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeBase64Url(value: string) {
  // Aceita base64 comum (+,/=) e converte para base64url (-,_ sem padding).
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "").trim();
}

export async function POST(req: NextRequest) {
  // Requer usuário autenticado
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const body = await req.json();
  const { endpoint, p256dh, auth } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const normalizedP256dh = normalizeBase64Url(String(p256dh));
  const normalizedAuth = normalizeBase64Url(String(auth));

  // O mesmo endpoint representa o mesmo navegador/dispositivo. Se ele ficou
  // associado a outra conta por troca de login, push para aquela conta aparece
  // neste aparelho como se fosse notificação da própria mensagem.
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .neq("user_id", user.id);

  // Upsert — atualiza se já existe o mesmo endpoint
  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh: normalizedP256dh, auth: normalizedAuth },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("push/subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { endpoint } = await req.json();
  if (endpoint) {
    await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  } else {
    // Remove todas as subscrições do usuário
    await admin.from("push_subscriptions").delete().eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
