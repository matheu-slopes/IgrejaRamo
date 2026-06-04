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

type CreateBody = {
  usuarioIds?: string[];
  todos?: boolean;
  roles?: string[];
  ministerios?: string[];
  titulo?: string;
  corpo?: string;
  tipo?: "aviso" | "escala" | "evento" | "ministerio" | "sistema";
  link?: string;
  ministerio?: string;
  excluirUsuarioId?: string;
};

async function resolverDestinatarios(body: CreateBody) {
  const explicit = [...new Set((body.usuarioIds ?? []).filter(Boolean))];
  if (explicit.length) return explicit;

  const query = admin.from("perfis").select("id, role, ministerios").eq("ativo", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const roles = new Set(body.roles ?? []);
  const ministerios = new Set(body.ministerios ?? []);
  const todos = body.todos || (!roles.size && !ministerios.size);

  return [...new Set((data ?? [])
    .filter((p: { id: string; role: string; ministerios?: string[] }) => {
      if (p.id === body.excluirUsuarioId) return false;
      if (todos) return true;
      const matchRole = roles.size > 0 && roles.has(p.role);
      const matchMinisterio = ministerios.size > 0 && (p.ministerios ?? []).some((m) => ministerios.has(m));
      return matchRole || matchMinisterio;
    })
    .map((p: { id: string }) => p.id)
    .filter(Boolean))];
}

export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as CreateBody;
  if (!body.titulo || !body.corpo || !body.tipo) {
    return NextResponse.json({ error: "titulo, corpo e tipo sao obrigatorios" }, { status: 400 });
  }

  try {
    const destinatarios = await resolverDestinatarios({ ...body, excluirUsuarioId: body.excluirUsuarioId ?? user.id });
    if (!destinatarios.length) return NextResponse.json({ ok: true, inserted: 0 });

    const rows = destinatarios.map((uid) => ({
      usuario_id: uid,
      titulo: body.titulo,
      corpo: body.corpo,
      tipo: body.tipo,
      link: body.link ?? null,
      ministerio: body.ministerio ?? null,
    }));

    const { data, error } = await admin.from("notificacoes").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: data?.length ?? rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
