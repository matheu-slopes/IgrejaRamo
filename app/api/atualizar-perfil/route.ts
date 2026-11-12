import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";

export async function POST(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
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

  if (id === auth.user.id && typeof dados.email === "string" && dados.email.trim().toLowerCase() === auth.user.email?.toLowerCase()) {
    delete dados.email;
  }
  const ownFields = ["nome", "email", "telefone", "foto", "dataNascimento", "primeiroAcesso"];
  const ownSafeUpdate = id === auth.user.id && Object.keys(dados).every((key) => ownFields.includes(key));
  if (!ownSafeUpdate && (!auth.permissions.includes("gerenciar_usuarios") || !auth.permissions.includes("atribuir_permissoes"))) return forbidden();
  if ((dados.role !== undefined || dados.permissoes !== undefined || dados.liderMinisterios !== undefined)
      && !auth.permissions.includes("atribuir_permissoes")) return forbidden();

  if (!id) {
    return NextResponse.json({ error: "ID do usuário ausente." }, { status: 400 });
  }

  if (dados.email !== undefined) {
    const email = String(dados.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const { error: authEmailError } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });

    if (authEmailError) {
      return NextResponse.json({ error: authEmailError.message }, { status: 400 });
    }

    dados.email = email;
  }

  const payload: Record<string, unknown> = {};
  if (dados.nome        !== undefined) payload.nome          = dados.nome;
  if (dados.email       !== undefined) payload.email         = dados.email;
  if (dados.telefone    !== undefined) payload.telefone      = dados.telefone;
  if (dados.foto        !== undefined) payload.foto          = dados.foto;
  if (dados.role        !== undefined) payload.role          = dados.role;
  if (dados.ministerios !== undefined) payload.ministerios   = dados.ministerios;
  if (dados.liderMinisterios !== undefined) payload.lider_ministerios = dados.liderMinisterios ?? [];
  if (dados.dataIngresso !== undefined) payload.data_ingresso = dados.dataIngresso;
  if (dados.dataNascimento !== undefined) payload.data_nascimento = dados.dataNascimento || null;
  if (dados.ativo       !== undefined) payload.ativo         = dados.ativo;
  if (dados.primeiroAcesso !== undefined) payload.primeiro_acesso = dados.primeiroAcesso;
  if (dados.permissoes  !== undefined) payload.permissoes    = dados.permissoes ?? [];

  const { error } = await admin.from("perfis").update(payload).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
