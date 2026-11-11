import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULTS_POR_ROLE } from "@/lib/permissions";
import type { Permissao, Role } from "@/types";

export async function securityAuth(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "Configuração de servidor ausente." }, { status: 500 }) };
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return { error: NextResponse.json({ error: "Sessão necessária." }, { status: 401 }) };
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return { error: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  const { data: perfil, error: perfilError } = await admin.from("perfis")
    .select("role, permissoes, ativo, lider_ministerios").eq("id", data.user.id).maybeSingle();
  if (perfilError || !perfil || perfil.ativo !== true) return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  const permissions: Permissao[] = Array.isArray(perfil.permissoes) && perfil.permissoes.length > 0
    ? perfil.permissoes : (DEFAULTS_POR_ROLE[perfil.role as Role] ?? []);
  return { admin, user: data.user, perfil, permissions };
}

export function forbidden() {
  return NextResponse.json({ error: "Sem permissão para esta operação." }, { status: 403 });
}
