import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll, sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolverUsuariosAlvo(opts: { todos?: boolean; roles?: string[]; ministerios?: string[] }) {
  const roles = new Set(opts.roles ?? []);
  const ministerios = new Set(opts.ministerios ?? []);
  const todos = opts.todos || (!roles.size && !ministerios.size);

  const { data, error } = await admin
    .from("perfis")
    .select("id, role, ministerios")
    .eq("ativo", true);

  if (error) throw new Error(error.message);

  return [...new Set((data ?? [])
    .filter((p: { id: string; role: string; ministerios?: string[] }) => {
      if (todos) return true;
      const porRole = roles.size > 0 && roles.has(p.role);
      const porMinisterio = ministerios.size > 0 && (p.ministerios ?? []).some((m) => ministerios.has(m));
      return porRole || porMinisterio;
    })
    .map((p: { id: string }) => p.id)
    .filter(Boolean))];
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { tipo, titulo, conteudo, ministerio, todos, roles, ministerios } = await req.json();
  if (!tipo || !titulo) {
    return NextResponse.json({ error: "tipo e titulo sao obrigatorios" }, { status: 400 });
  }

  const nowTag = Date.now().toString();

  try {
    let delivery = {
      attempted: 0,
      sent: 0,
      failed: 0,
      removed: 0,
      errors: [] as Array<{ status: number | "unknown"; message: string }>,
    };

    if (tipo === "aviso") {
      const payload = {
        title: "Novo aviso",
        body: titulo,
        url: "/dashboard/mural",
        tag: `aviso-${nowTag}`,
      };

      if (todos || (!roles?.length && !ministerios?.length)) {
        delivery = await sendPushToAll(payload);
      } else {
        const ids = await resolverUsuariosAlvo({ todos, roles, ministerios });
        if (!ids.length) return NextResponse.json({ ok: false, error: "Nenhum destinatario encontrado para o aviso", delivery });
        delivery = await sendPushToUsers(ids, payload);
      }
    } else if (tipo === "evento") {
      const body = `${titulo}${conteudo ? ` - ${conteudo}` : ""}`;
      if (ministerio) {
        const { data: membros } = await admin
          .from("membros_ministerio")
          .select("usuario_id")
          .eq("ministerio", ministerio);
        const ids = (membros ?? []).map((m: { usuario_id: string }) => m.usuario_id);
        if (!ids.length) return NextResponse.json({ ok: false, error: "Nenhum membro encontrado para o ministerio", delivery });
        delivery = await sendPushToUsers(ids, {
          title: `Novo evento - ${ministerio}`,
          body,
          url: "/dashboard/eventos",
          tag: `evento-${nowTag}`,
        });
      } else {
        delivery = await sendPushToAll({
          title: "Novo evento",
          body,
          url: "/dashboard/eventos",
          tag: `evento-${nowTag}`,
        });
      }
    } else {
      return NextResponse.json({ ok: false, error: "tipo invalido" }, { status: 400 });
    }

    const ok = delivery.sent > 0;
    return NextResponse.json({ ok, delivery, error: ok ? null : "Push nao entregue para nenhum dispositivo" });
  } catch (e) {
    console.error("push/broadcast error:", e);
    return NextResponse.json({ ok: false, error: "Falha interna no envio de push" }, { status: 500 });
  }
}
