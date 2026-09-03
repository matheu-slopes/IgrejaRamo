import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/push/escalas-reminder?type=vespera
 * GET /api/push/escalas-reminder?type=hoje
 * Chamado pelo Vercel Cron.
 * Busca as escalas visíveis com base no parâmetro 'type' e envia push para os voluntários.
 */
export async function GET(req: NextRequest) {
  // Proteção — Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "").trim();
  const secret = bearerSecret ?? req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Identifica o tipo de lembrete
  const type = req.nextUrl.searchParams.get("type");
  
  if (type !== "vespera" && type !== "hoje") {
    return NextResponse.json({ error: "Tipo inválido. Use ?type=vespera ou ?type=hoje" }, { status: 400 });
  }

  // Calcula a data alvo considerando o fuso horário de Brasília
  const dataAlvo = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  // Se for véspera, adiciona 1 dia para buscar as escalas de amanhã
  if (type === "vespera") {
    dataAlvo.setDate(dataAlvo.getDate() + 1);
  }

  const dataString = dataAlvo.toISOString().split("T")[0];

  // Busca escalas da data alvo (visíveis)
  const { data: escalas, error: errEscalas } = await admin
    .from("escalas")
    .select("id, culto, horario, ministerio")
    .eq("data", dataString)
    .eq("visivel", true);

  if (errEscalas || !escalas?.length) {
    return NextResponse.json({ ok: true, enviados: 0, msg: `Nenhuma escala encontrada para ${dataString}` });
  }

  let totalEnviados = 0;
  let totalFalhas = 0;
  let totalTentativas = 0;
  const erros: string[] = [];

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
      
      // Define a mensagem com base no tipo de lembrete
      const title = type === "vespera" ? `⏰ Lembrete de Véspera!` : `🎶 Lembrete: Escala Hoje!`;
      const body = type === "vespera"
        ? `Amanhã você serve em: ${escala.culto} às ${horario} (${funcaoStr}). Organize-se!`
        : `${escala.culto} às ${horario} — função: ${funcaoStr}. Te esperamos!`;

      const delivery = await sendPushToUsers([userId], {
        title,
        body,
        url: "/dashboard/escalas",
        tag: `escala-${escala.id}-${userId}-${type}`,
      });
      
      totalTentativas += delivery.attempted;
      totalEnviados += delivery.sent;
      totalFalhas += delivery.failed;
      
      if (delivery.errors[0]?.message) {
        erros.push(delivery.errors[0].message);
      }
    }
  }

  return NextResponse.json({
    ok: totalEnviados > 0,
    enviados: totalEnviados,
    falhas: totalFalhas,
    tentativas: totalTentativas,
    data: dataString,
    tipo: type,
    sample_error: erros[0] ?? null,
  });
}