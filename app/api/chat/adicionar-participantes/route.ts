import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingColumn(error: unknown, column: string) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes(column.toLowerCase());
}

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
  const incluirHistorico = Boolean(body.incluir_historico);

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

  if ((conversa as { tipo: string }).tipo !== "grupo") {
    return NextResponse.json({ error: "Participantes extras so podem ser adicionados a grupos" }, { status: 400 });
  }

  const { data: perfil } = await admin
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (perfil as { role?: string } | null)?.role;
  const isOwner = (conversa as { admin_id?: string | null }).admin_id === user.id;
  const canManage = isOwner || role === "admin" || role === "pastor";

  if (!canManage) {
    return NextResponse.json({ error: "Sem permissao para adicionar membros neste grupo" }, { status: 403 });
  }

  const { data: existentes, error: existingErr } = await admin
    .from("chat_participantes")
    .select("user_id")
    .eq("conversa_id", conversaId)
    .in("user_id", participantes);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const existingIds = new Set((existentes ?? []).map((p: { user_id: string }) => p.user_id));
  const novos = participantes.filter((id: string) => !existingIds.has(id));

  if (!novos.length) {
    return NextResponse.json({ ok: true, adicionados: [] });
  }

  const historicoDesde = incluirHistorico ? null : new Date().toISOString();
  let { error: insertErr } = await admin
    .from("chat_participantes")
    .insert(novos.map((uid: string) => ({
      conversa_id: conversaId,
      user_id: uid,
      historico_desde: historicoDesde,
    })));

  if (insertErr && isMissingColumn(insertErr, "historico_desde")) {
    const fallback = await admin
      .from("chat_participantes")
      .insert(novos.map((uid: string) => ({
        conversa_id: conversaId,
        user_id: uid,
      })));
    insertErr = fallback.error;
  }

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, adicionados: novos, historico_desde: historicoDesde });
}
