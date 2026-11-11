import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";

export async function DELETE(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  if (!auth.permissions.includes("gerenciar_usuarios")) return forbidden();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Configuração de servidor ausente." }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;
  try {
    const body = await req.json();
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId ausente." }, { status: 400 });
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta." }, { status: 400 });
  }

  // A exclusão do usuário de autenticação remove o perfil por cascata, na mesma
  // transação do banco. Nunca apague o perfil antes de saber se ela foi concluída.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
