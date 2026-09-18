import { NextRequest, NextResponse } from "next/server";
import { youtubeId } from "@/lib/youtubeSearch";
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

function uuidValido(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const body = (await req.json().catch(() => null) ?? {}) as {
    url?: string; titulo?: string; artista?: string; thumbnailUrl?: string; escalaId?: string; musicaId?: string; tomAlvo?: string | null; mode?: string;
  };
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!youtubeUrlValida(url) || !youtubeId(url)) return NextResponse.json({ error: "Use um link válido do YouTube." }, { status: 400 });
  const mode=body.mode??"bs_roformer";
  if (!["bs_roformer","htdemucs_ft"].includes(mode)) return NextResponse.json({error:"Modo inválido."},{status:400});
  const {count} = await louvorStudioAdmin.from("louvor_studio_projetos").select("id",{count:"exact",head:true}).eq("criado_por",user.id).in("status",["aguardando","baixando","analisando","separando"]);
  if ((count??0)>=3) return NextResponse.json({error:"Aguarde as músicas em processamento."},{status:429});
  const escalaId = typeof body?.escalaId === "string" ? body.escalaId.trim() : "";
  const musicaId = typeof body?.musicaId === "string" ? body.musicaId.trim() : "";
  if (musicaId && !uuidValido(musicaId)) return NextResponse.json({ error: "Música do Repertório inválida." }, { status: 400 });
  let escala: { id: string; ministerio: string; data: string } | null = null;
  if (escalaId) {
    const { data } = await louvorStudioAdmin
      .from("escalas").select("id, ministerio, data").eq("id", escalaId).maybeSingle();
    escala = data;
    if (musicaId && escala?.id) {
      const { data: musicaDaEscala } = await louvorStudioAdmin
        .from("escala_musicas")
        .select("id")
        .eq("escala_id", escala.id)
        .eq("musica_id", musicaId)
        .maybeSingle();
      if (!musicaDaEscala) return NextResponse.json({ error: "Essa música não faz parte do set deste culto." }, { status: 400 });
    }
    if (!escala || escala.ministerio !== "Louvor") return NextResponse.json({ error: "Escala de Louvor inválida." }, { status: 400 });
  }
  if (!escalaId && musicaId) {
    const { data: musica } = await louvorStudioAdmin.from("musicas").select("id").eq("id", musicaId).maybeSingle();
    if (!musica) return NextResponse.json({ error: "Música do Repertório não encontrada." }, { status: 404 });
  }
  const expiraEm = escala
    ? expiracaoDaEscala(escala.data)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: projeto, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .insert({
      criado_por: user.id,
      separation_mode: mode,
      pipeline_version: 2,
      escala_id: escala?.id ?? null,
      musica_id: musicaId || null,
      youtube_url: url,
      titulo: (typeof body.titulo === "string" ? body.titulo.trim() : "") || "Processando música",
      artista: (typeof body.artista === "string" ? body.artista.trim() : "") || null,
      thumbnail_url: body.thumbnailUrl || null,
      tom_alvo: typeof body.tomAlvo === "string" ? body.tomAlvo.trim() || null : null,
      expira_em: expiraEm,
      status: "aguardando",
      progresso: 0,
      erro: null,
    })
    .select("*")
    .single();
  if (error && ["PGRST204", "42703"].includes(error.code)) {
    const detalhe = String(error.message ?? "").toLowerCase();
    const migration = detalhe.includes("musica_id")
      ? "Aplique a migration 20260918_escala_repertorio_studio.sql no Supabase para ligar esta música ao Studio."
      : "Aplique a migration de áudio HQ para preparar novas músicas.";
    return NextResponse.json({ error: migration }, { status: 503 });
  }
  if (error || !projeto) return NextResponse.json({ error: error?.message ?? "Não foi possível criar a tarefa." }, { status: 500 });
  // Este é o momento de confirmação humana do vídeo. A partir daqui ele vira
  // a sugestão reutilizável do Repertório para os próximos cultos.
  if (musicaId) {
    const { error: repertorioError } = await louvorStudioAdmin
      .from("musicas")
      .update({ link_youtube: url })
      .eq("id", musicaId);
    if (repertorioError) console.error("Não foi possível salvar o vídeo confirmado no Repertório:", repertorioError.message);
  }
  return NextResponse.json({ projeto }, { status: 202 });
}
