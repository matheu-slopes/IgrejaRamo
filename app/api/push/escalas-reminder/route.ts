import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Pessoa = { nome: string; funcoes: string[]; pendente: boolean; recusado: boolean };

async function reservar(escalaId: string, usuarioId: string, tipo: string, referencia: string) {
  const { error } = await admin.from("escala_push_entregas").insert({ escala_id: escalaId, usuario_id: usuarioId, tipo, referencia });
  if (!error) return true;
  if (error.code === "23505") return false;
  if (error.code === "42P01" || error.message?.toLowerCase().includes("schema cache")) return true;
  throw new Error(error.message);
}

async function notificarInterno(usuarioId: string, titulo: string, corpo: string, ministerio: string, link = "/dashboard/escalas?aba=minhas") {
  await admin.from("notificacoes").insert({ usuario_id: usuarioId, titulo, corpo, tipo: "escala", link, ministerio });
}

function dataBrasilia(diasAdiante: number) {
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setDate(hoje.getDate() + diasAdiante);
  return hoje.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const secret = bearer ?? req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "vespera" && type !== "hoje") return NextResponse.json({ error: "Use ?type=vespera ou ?type=hoje" }, { status: 400 });
  const referencia = dataBrasilia(type === "vespera" ? 1 : 0);

  const { data: escalas, error } = await admin.from("escalas").select("id, culto, horario, ministerio").eq("data", referencia).eq("visivel", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!escalas?.length) return NextResponse.json({ ok: true, enviados: 0, data: referencia, tipo: type });

  let enviados = 0, falhas = 0, tentativas = 0, ignoradosDuplicados = 0;
  for (const escala of escalas) {
    const { data: itens, error: itensError } = await admin.from("escala_itens")
      .select("voluntario_id, voluntario_nome, funcao, confirmado, confirmacao_status")
      .eq("escala_id", escala.id).not("voluntario_id", "is", null);
    if (itensError || !itens?.length) continue;

    const pessoas = new Map<string, Pessoa>();
    for (const item of itens) {
      const pessoa: Pessoa = pessoas.get(item.voluntario_id) ?? { nome: item.voluntario_nome, funcoes: [], pendente: false, recusado: false };
      pessoa.funcoes.push(item.funcao);
      const status = item.confirmacao_status ?? (item.confirmado ? "confirmado" : "pendente");
      pessoa.pendente ||= status === "pendente";
      pessoa.recusado ||= status === "recusado";
      pessoas.set(item.voluntario_id, pessoa);
    }

    const horario = String(escala.horario).slice(0, 5);
    for (const [usuarioId, pessoa] of pessoas) {
      if (!(await reservar(escala.id, usuarioId, type, referencia))) { ignoradosDuplicados++; continue; }
      const titulo = type === "vespera" ? "Lembrete de vespera" : "Sua escala e hoje";
      let corpo = type === "vespera"
        ? `Amanha voce serve em ${escala.culto}, as ${horario} (${pessoa.funcoes.join(", ")}).`
        : `${escala.culto}, as ${horario} - ${pessoa.funcoes.join(", ")}.`;
      if (pessoa.pendente) corpo += " Sua confirmacao ainda esta pendente. Confirme em Meus Servicos.";
      else if (pessoa.recusado) corpo += " Voce informou que nao podera servir; procure seu lider se isso mudou.";
      else corpo += " Presenca confirmada. Te esperamos!";
      await notificarInterno(usuarioId, titulo, corpo, escala.ministerio);
      const delivery = await sendPushToUsers([usuarioId], { title: titulo, body: corpo, url: "/dashboard/escalas?aba=minhas", tag: `escala-${escala.id}-${type}-${referencia}` });
      tentativas += delivery.attempted; enviados += delivery.sent; falhas += delivery.failed;
    }

    if (type === "vespera") {
      const pendentes = [...pessoas.values()].filter((p) => p.pendente).map((p) => p.nome);
      const recusados = [...pessoas.values()].filter((p) => p.recusado).map((p) => p.nome);
      if (pendentes.length || recusados.length) {
        const { data: lideres } = await admin.from("perfis").select("id").eq("ativo", true).contains("lider_ministerios", [escala.ministerio]);
        const resumo = [pendentes.length ? `Pendentes: ${pendentes.join(", ")}.` : "", recusados.length ? `Nao poderao: ${recusados.join(", ")}.` : ""].filter(Boolean).join(" ");
        for (const lider of lideres ?? []) {
          if (!(await reservar(escala.id, lider.id, "resumo_lider", referencia))) { ignoradosDuplicados++; continue; }
          const titulo = `Resumo da escala - ${escala.ministerio}`;
          await notificarInterno(lider.id, titulo, resumo, escala.ministerio, "/dashboard/escalas");
          const delivery = await sendPushToUsers([lider.id], { title: titulo, body: resumo, url: "/dashboard/escalas", tag: `resumo-${escala.id}-${referencia}` });
          tentativas += delivery.attempted; enviados += delivery.sent; falhas += delivery.failed;
        }
      }
    }
  }
  return NextResponse.json({ ok: true, enviados, falhas, tentativas, ignoradosDuplicados, data: referencia, tipo: type });
}
