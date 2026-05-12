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

  try {
    if (tipo === "aviso") {
      await sendPushToAll({
        title: `📢 Novo aviso`,
        body: titulo,
        url: "/dashboard/mural",
        tag: "aviso-novo",
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
          await sendPushToUsers(ids, {
            title: `📅 Novo evento — ${ministerio}`,
            body: `${titulo}${conteudo ? ` · ${conteudo}` : ""}`,
            url: "/dashboard/eventos",
            tag: "evento-novo",
          });
        }
      } else {
        await sendPushToAll({
          title: `📅 Novo evento`,
          body: `${titulo}${conteudo ? ` · ${conteudo}` : ""}`,
          url: "/dashboard/eventos",
          tag: "evento-novo",
        });
      }
    }
  } catch (e) {
    console.error("push/broadcast error:", e);
    // Não falha o request por causa do push
  }

  return NextResponse.json({ ok: true });
}
