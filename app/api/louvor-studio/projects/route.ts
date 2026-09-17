import { NextRequest, NextResponse } from "next/server";
import {
  getLouvorStudioAccess,
  getLouvorStudioUser,
  limparProjetosExpirados,
  louvorStudioAdmin,
  workerConfigurado,
} from "@/lib/louvorStudioServer";

type ProjetoRow = {
  id: string;
  audio_path?: string | null;
  stems?: Record<string, string> | null;
  [key: string]: unknown;
};

function youtubeUrlValida(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
  } catch { return false; }
}

function expiracaoDaEscala(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + 2, 3, 0, 0)).toISOString();
}

async function assinarProjeto(projeto: ProjetoRow) {
  const paths = Object.values(projeto.stems ?? {}).filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  await Promise.all(paths.map(async (path) => {
    const { data } = await louvorStudioAdmin.storage.from("louvor-studio").createSignedUrl(path, 6 * 60 * 60);
    if (data?.signedUrl) urls[path] = data.signedUrl;
  }));

  return {
    ...projeto,
    stem_urls: Object.fromEntries(Object.entries(projeto.stems ?? {}).map(([nome, path]) => [nome, urls[path] ?? null])),
    audio_path: undefined,
    stems: undefined,
  };
}

export async function GET(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);
  if (!acesso.podeVer) return NextResponse.json({ error: "Acesso restrito ao ministério de Louvor." }, { status: 403 });

  await limparProjetosExpirados();
  const { data, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .select("*, escalas(id, culto, data, horario)")
    .order("criado_em", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let escalas: unknown[] = [];
  if (acesso.podeGerenciar) {
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const { data: proximas } = await louvorStudioAdmin
      .from("escalas")
      .select("id, culto, data, horario")
      .eq("ministerio", "Louvor")
      .gte("data", hoje)
      .order("data")
      .order("horario")
      .limit(30);
    escalas = proximas ?? [];
  }

  return NextResponse.json({
    projetos: await Promise.all((data ?? []).map((p) => assinarProjeto(p as ProjetoRow))),
    escalas,
  });
}

export async function POST(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);
  if (!acesso.podeGerenciar) return NextResponse.json({ error: "Somente ministros e líderes podem preparar músicas." }, { status: 403 });
  if (!workerConfigurado()) return NextResponse.json({ error: "Configure LOUVOR_STUDIO_WORKER_SECRET na Vercel." }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    url?: string; titulo?: string; artista?: string; thumbnailUrl?: string; escalaId?: string; tomAlvo?: string;
  } | null;
  const url = body?.url?.trim() ?? "";
  if (!youtubeUrlValida(url)) return NextResponse.json({ error: "Use um link válido do YouTube." }, { status: 400 });
  if (!body?.escalaId) return NextResponse.json({ error: "Escolha a escala em que a música será usada." }, { status: 400 });
  if (!body?.tomAlvo) return NextResponse.json({ error: "Escolha o tom definido pelo ministro." }, { status: 400 });

  const { data: escala } = await louvorStudioAdmin
    .from("escalas").select("id, ministerio, data").eq("id", body.escalaId).maybeSingle();
  if (!escala || escala.ministerio !== "Louvor") return NextResponse.json({ error: "Escala de Louvor inválida." }, { status: 400 });

  const { data: projeto, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .insert({
      criado_por: user.id,
      escala_id: escala.id,
      youtube_url: url,
      titulo: body.titulo?.trim() || "Processando música",
      artista: body.artista?.trim() || null,
      thumbnail_url: body.thumbnailUrl || null,
      tom_alvo: body.tomAlvo,
      expira_em: expiracaoDaEscala(escala.data),
      status: "aguardando",
      progresso: 0,
      erro: null,
    })
    .select("*")
    .single();
  if (error || !projeto) return NextResponse.json({ error: error?.message ?? "Não foi possível criar a tarefa." }, { status: 500 });
  return NextResponse.json({ projeto }, { status: 202 });
}
