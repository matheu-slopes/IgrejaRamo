import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll, sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/broadcast
 * Body: { tipo: "aviso" | "evento", titulo, conteudo?, ministerio? }
 * Requer usuário autenticado com permissão criar_aviso ou criar_evento.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { tipo, titulo, conteudo, ministerio } = await req.json();

  if (!tipo || !titulo) {
    return NextResponse.json({ error: "tipo e titulo são obrigatórios" }, { status: 400 });
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
      delivery = await sendPushToAll({
        title: `📢 Novo aviso`,
        body: titulo,
        url: "/dashboard/mural",
        tag: `aviso-${nowTag}`,
      });
    } else if (tipo === "evento") {
      // Se o evento é de um ministério específico, notifica apenas membros do ministério
      if (ministerio) {
        const { data: membros } = await admin
          .from("membros_ministerio")
          .select("usuario_id")
          .eq("ministerio", ministerio);
        const ids = (membros ?? []).map((m: { usuario_id: string }) => m.usuario_id);
        if (ids.length > 0) {
          delivery = await sendPushToUsers(ids, {
            title: `📅 Novo evento — ${ministerio}`,
            body: `${titulo}${conteudo ? ` · ${conteudo}` : ""}`,
            url: "/dashboard/eventos",
            tag: `evento-${nowTag}`,
          });
        } else {
          return NextResponse.json({ ok: false, error: "Nenhum membro encontrado para o ministério", delivery });
        }
      } else {
        delivery = await sendPushToAll({
          title: `📅 Novo evento`,
          body: `${titulo}${conteudo ? ` · ${conteudo}` : ""}`,
          url: "/dashboard/eventos",
          tag: `evento-${nowTag}`,
        });
      }
    } else {
      return NextResponse.json({ ok: false, error: "tipo inválido" }, { status: 400 });
    }

    const ok = delivery.sent > 0;
    return NextResponse.json({ ok, delivery, error: ok ? null : "Push não entregue para nenhum dispositivo" });
  } catch (e) {
    console.error("push/broadcast error:", e);
    return NextResponse.json({ ok: false, error: "Falha interna no envio de push" }, { status: 500 });
  }
}
