import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/push/escalas-reminder
 * Chamado pelo Vercel Cron às 12:00 e 18:00 (horário de Brasília = UTC-3).
 * Busca todas as escalas visíveis de HOJE e envia push para cada voluntário escalado.
 */
export async function GET(req: NextRequest) {
  // Proteção — Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  // Aceita também x-cron-secret header ou query param (para testes locais)
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "").trim();
  const secret = bearerSecret ?? req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Data de hoje em Brasília
  const hoje = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  )
    .toISOString()
    .split("T")[0];

  // Busca escalas de hoje (visíveis)
  const { data: escalas, error: errEscalas } = await admin
    .from("escalas")
    .select("id, culto, horario, ministerio")
    .eq("data", hoje)
    .eq("visivel", true);

  if (errEscalas || !escalas?.length) {
    return NextResponse.json({ ok: true, enviados: 0, msg: "Nenhuma escala hoje" });
  }

  let totalEnviados = 0;

  for (const escala of escalas) {
    // Busca itens da escala com voluntário atribuído
    const { data: itens } = await admin
      .from("escala_itens")
      .select("voluntario_id, voluntario_nome, funcao")
      .eq("escala_id", escala.id)
      .not("voluntario_id", "is", null);

    if (!itens?.length) continue;

    // Agrupa por voluntário para não mandar múltiplas notificações para o mesmo usuário
    const porVoluntario = new Map<string, string[]>();
    for (const item of itens) {
      if (!porVoluntario.has(item.voluntario_id)) {
        porVoluntario.set(item.voluntario_id, []);
      }
      porVoluntario.get(item.voluntario_id)!.push(item.funcao);
    }

    // Formata horário
    const horario = (escala.horario as string).slice(0, 5); // HH:MM

    for (const [userId, funcoes] of porVoluntario) {
      const funcaoStr = funcoes.join(", ");
      await sendPushToUsers([userId], {
        title: `🎶 Você está escalado hoje!`,
        body: `${escala.culto} às ${horario} — função: ${funcaoStr}`,
        url: "/dashboard/escalas",
        tag: `escala-${escala.id}-${userId}`,
      });
      totalEnviados++;
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, data: hoje });
}
