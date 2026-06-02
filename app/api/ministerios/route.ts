import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULTS_POR_ROLE } from "@/lib/permissions";
import { Permissao, Role } from "@/types";

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceRoleKey || !supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Configuração de servidor ausente." }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: perfil, error: perfilError } = await admin
    .from("perfis")
    .select("id, role, permissoes")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const role = perfil.role as Role;
  const permissoes = Array.isArray(perfil.permissoes) && perfil.permissoes.length > 0
    ? perfil.permissoes as Permissao[]
    : DEFAULTS_POR_ROLE[role] ?? [];

  if (!permissoes.includes("gerenciar_usuarios")) {
    return NextResponse.json({ error: "Sem permissão para criar ministérios." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ");

  if (!nome) {
    return NextResponse.json({ error: "Digite o nome do ministério." }, { status: 400 });
  }

  const { data: existente } = await admin
    .from("canais_ministerio")
    .select("ministerio")
    .ilike("ministerio", nome)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ error: "Já existe um ministério com esse nome." }, { status: 409 });
  }

  const { error } = await admin.from("canais_ministerio").insert({
    ministerio: nome,
    descricao: `Canal do ministério ${nome}`,
    cor: "vine",
    chat_bloqueado: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ministerio: nome });
}
