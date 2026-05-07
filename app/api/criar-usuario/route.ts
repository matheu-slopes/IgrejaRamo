import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Configuração de servidor ausente." }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json();
  const { email, senha, nome, telefone, role, ministerios, dataIngresso, ativo, permissoes } = body;

  if (!email || !senha || !nome) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Erro ao criar usuário." }, { status: 400 });
  }

  await admin.from("perfis").upsert({
    id:            data.user.id,
    nome,
    email,
    telefone:      telefone ?? null,
    role,
    ministerios:   ministerios ?? [],
    data_ingresso: dataIngresso ?? null,
    ativo:         ativo ?? true,
    permissoes:    permissoes ?? [],
  });

  return NextResponse.json({ id: data.user.id });
}
