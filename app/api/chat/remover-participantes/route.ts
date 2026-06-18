import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversaId = String(body.conversa_id ?? "");
  const participantes: string[] = Array.isArray(body.participantes)
    ? Array.from(new Set<string>(body.participantes.filter((id: unknown): id is string => typeof id === "string" && Boolean(id))))
    : [];

  if (!conversaId || participantes.length === 0) {
    return NextResponse.json({ error: "Conversa e participantes sao obrigatorios" }, { status: 400 });
  }

  const { data: conversa, error: convErr } = await admin
    .from("chat_conversas")
    .select("id, tipo, admin_id")
    .eq("id", conversaId)
    .single();

  if (convErr || !conversa) {
    return NextResponse.json({ error: convErr?.message ?? "Grupo nao encontrado" }, { status: 404 });
  }

  const grupo = conversa as { tipo: string; admin_id?: string | null };
  if (grupo.tipo !== "grupo") {
    return NextResponse.json({ error: "Participantes so podem ser removidos de grupos" }, { status: 400 });
  }

  const { data: perfil } = await admin
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (perfil as { role?: string } | null)?.role;
  const isOwner = grupo.admin_id === user.id;
  const canManage = isOwner || role === "admin" || role === "pastor";

  if (!canManage) {
    return NextResponse.json({ error: "Sem permissao para remover membros deste grupo" }, { status: 403 });
  }

  const removiveis = participantes.filter((id) => id !== user.id && id !== grupo.admin_id);
  if (!removiveis.length) {
    return NextResponse.json({ ok: true, removidos: [] });
  }

  const { error: deleteErr } = await admin
    .from("chat_participantes")
    .delete()
    .eq("conversa_id", conversaId)
    .in("user_id", removiveis);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removidos: removiveis });
}
