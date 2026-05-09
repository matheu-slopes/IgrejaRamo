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
  const { id, ...dados } = body;

  if (!id) {
    return NextResponse.json({ error: "ID do usuário ausente." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (dados.nome        !== undefined) payload.nome          = dados.nome;
  if (dados.email       !== undefined) payload.email         = dados.email;
  if (dados.telefone    !== undefined) payload.telefone      = dados.telefone;
  if (dados.foto        !== undefined) payload.foto          = dados.foto;
  if (dados.role        !== undefined) payload.role          = dados.role;
  if (dados.ministerios !== undefined) payload.ministerios   = dados.ministerios;
  if (dados.dataIngresso !== undefined) payload.data_ingresso = dados.dataIngresso;
  if (dados.ativo       !== undefined) payload.ativo         = dados.ativo;
  if (dados.primeiroAcesso !== undefined) payload.primeiro_acesso = dados.primeiroAcesso;
  if (dados.permissoes  !== undefined) payload.permissoes    = dados.permissoes ?? [];

  const { error } = await admin.from("perfis").update(payload).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
