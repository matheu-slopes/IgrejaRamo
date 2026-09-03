import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/sendPush";
import { DEFAULTS_POR_ROLE } from "@/lib/permissions";
import type { Permissao, Role } from "@/types";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Acao = "alterada" | "cobrar_pendentes" | "aviso_geral";
type Perfil = {
  id: string;
  role: Role;
  permissoes?: Permissao[] | null;
  lider_ministerios?: string[] | null;
  ativo?: boolean;
};

function podeEditarEscala(perfil: Perfil, ministerio: string) {
  const permissoes = perfil.permissoes ?? DEFAULTS_POR_ROLE[perfil.role] ?? [];
  return permissoes.includes("criar_escala") || Boolean(perfil.lider_ministerios?.includes(ministerio));
}

function dataPtBr(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${data}T00:00:00Z`));
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ ok: false, error: "Token invalido" }, { status: 401 });

  const body = await req.json().catch(() => null) as { escalaId?: string; acao?: Acao; mensagem?: string } | null;
  if (!body?.escalaId || !body.acao || !["alterada", "cobrar_pendentes", "aviso_geral"].includes(body.acao)) {
    return NextResponse.json({ ok: false, error: "escalaId e acao valida sao obrigatorios" }, { status: 400 });
  }

  const [{ data: perfil, error: perfilError }, { data: escala, error: escalaError }] = await Promise.all([
    admin.from("perfis").select("id, role, permissoes, lider_ministerios, ativo").eq("id", user.id).maybeSingle(),
    admin.from("escalas").select("id, culto, data, horario, ministerio, confirmacao_participantes").eq("id", body.escalaId).maybeSingle(),
  ]);

  if (perfilError || !perfil || !perfil.ativo) return NextResponse.json({ ok: false, error: "Perfil sem acesso" }, { status: 403 });
  if (escalaError) return NextResponse.json({ ok: false, error: escalaError.message }, { status: 500 });
  if (!escala) return NextResponse.json({ ok: false, error: "Escala nao encontrada" }, { status: 404 });

  const somenteAdmin = body.acao === "cobrar_pendentes" || body.acao === "aviso_geral";
  if (somenteAdmin && perfil.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acao exclusiva de administrador" }, { status: 403 });
  }
  if (!somenteAdmin && !podeEditarEscala(perfil as Perfil, escala.ministerio)) {
    return NextResponse.json({ ok: false, error: "Sem permissao para notificar esta escala" }, { status: 403 });
  }

  if (body.acao === "aviso_geral") {
    const mensagem = body.mensagem?.trim();
    if (!mensagem) return NextResponse.json({ ok: false, error: "Mensagem obrigatoria" }, { status: 400 });
    if (mensagem.length > 500) return NextResponse.json({ ok: false, error: "Mensagem limitada a 500 caracteres" }, { status: 400 });
  }

  // Uma criacao/edicao invalida todas as respostas anteriores, independentemente
  // de qual campo mudou. O servidor faz o reset para nao depender do cliente.
  if (body.acao === "alterada") {
    const { error } = await admin.from("escala_itens").update({
      confirmado: false,
      confirmado_em: null,
      confirmacao_status: "pendente",
    }).eq("escala_id", escala.id);
    if (error) return NextResponse.json({ ok: false, error: `Falha ao resetar confirmacoes: ${error.message}` }, { status: 500 });
  }

  let itensQuery = admin.from("escala_itens").select("voluntario_id").eq("escala_id", escala.id).not("voluntario_id", "is", null);
  if (body.acao === "cobrar_pendentes") itensQuery = itensQuery.eq("confirmacao_status", "pendente");
  const { data: itens, error: itensError } = await itensQuery;
  if (itensError) return NextResponse.json({ ok: false, error: itensError.message }, { status: 500 });

  const destinatarios = [...new Set((itens ?? []).map((item) => item.voluntario_id as string).filter(Boolean))];
  if (!destinatarios.length) {
    return NextResponse.json({ ok: true, destinatarios: 0, notificacoesInApp: 0, delivery: { attempted: 0, sent: 0, failed: 0, removed: 0, errors: [] } });
  }

  const horario = String(escala.horario).slice(0, 5);
  const quando = `${dataPtBr(escala.data)} as ${horario}`;
  const conteudo = body.acao === "aviso_geral"
    ? body.mensagem!.trim()
    : body.acao === "cobrar_pendentes"
      ? `Sua resposta para ${escala.culto}, em ${quando}, ainda esta pendente. Confirme em Meus Servicos.`
      : `A escala ${escala.culto}, em ${quando}, foi criada ou alterada. Confirme sua presenca em Meus Servicos.`;
  const titulo = body.acao === "aviso_geral"
    ? `Aviso da escala: ${escala.culto}`
    : body.acao === "cobrar_pendentes" ? "Confirmacao de escala pendente" : "Escala criada ou atualizada";
  const url = "/dashboard/escalas?aba=minhas";

  const rows = destinatarios.map((usuarioId) => ({
    usuario_id: usuarioId,
    titulo,
    corpo: conteudo,
    tipo: "escala",
    link: url,
    ministerio: escala.ministerio,
  }));
  const { data: inseridas, error: notificacaoError } = await admin.from("notificacoes").insert(rows).select("id");
  if (notificacaoError) return NextResponse.json({ ok: false, error: notificacaoError.message }, { status: 500 });

  const delivery = await sendPushToUsers(destinatarios, {
    title: titulo,
    body: conteudo,
    url,
    tag: `escala-${escala.id}-${body.acao}-${Date.now()}`,
  });

  return NextResponse.json({
    ok: true,
    destinatarios: destinatarios.length,
    notificacoesInApp: inseridas?.length ?? rows.length,
    delivery,
    warning: delivery.sent === 0 ? "Notificacao interna criada, mas nenhum dispositivo recebeu Web Push" : null,
  });
}
