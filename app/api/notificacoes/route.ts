import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user ?? null;
}

export async function PATCH(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { ids?: string[]; all?: boolean };
  const ids = (body.ids ?? []).filter(Boolean);

  let query = admin
    .from("notificacoes")
    .update({ lida: true })
    .eq("usuario_id", user.id)
    .eq("lida", false);

  if (!body.all) {
    if (!ids.length) return NextResponse.json({ ok: true, updated: 0 });
    query = query.in("id", ids);
  }

  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: data?.length ?? ids.length });
}

export async function DELETE(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { ids?: string[]; all?: boolean };
  const ids = (body.ids ?? []).filter(Boolean);

  let query = admin
    .from("notificacoes")
    .delete()
    .eq("usuario_id", user.id);

  if (!body.all) {
    if (!ids.length) return NextResponse.json({ ok: true, deleted: 0 });
    query = query.in("id", ids);
  }

  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: data?.length ?? ids.length });
}
