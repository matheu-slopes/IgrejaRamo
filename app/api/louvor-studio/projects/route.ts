import { NextRequest, NextResponse } from "next/server";
import { youtubeId } from "@/lib/youtubeSearch";
import { getLouvorStudioAccess, getLouvorStudioUser, limparProjetosExpirados, louvorStudioAdmin, recuperarProcessamentosLouvorTravados, workerConfigurado } from "@/lib/louvorStudioServer";
import { criarUrlDeLeitura } from "@/lib/louvorStudioStorage";

type ProjetoRow = { id: string; audio_path?: string | null; stems?: Record<string, string> | null; [key: string]: unknown };
type UsoDaEscala = { escala_id: string; musica_id: string | null; studio_projeto_id: string };
const MODELO_COMPLETO = "htdemucs_ft";
const DIAS_BIBLIOTECA = 90;
const DIAS_ENSAIO_PESSOAL = 7;
const expiraEmDias = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString();

function youtubeUrlValida(value: string) {
  try { return ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(new URL(value).hostname.toLowerCase().replace(/^www\./, "")); }
  catch { return false; }
}
function uuidValido(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function assinarProjeto(projeto: ProjetoRow) {
  const paths = Object.values(projeto.stems ?? {}).filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  await Promise.all(paths.map(async (path) => { try { urls[path] = await criarUrlDeLeitura(path); } catch { /* arquivo expirado */ } }));
  return { ...projeto, stem_urls: Object.fromEntries(Object.entries(projeto.stems ?? {}).map(([nome, path]) => [nome, urls[path] ?? null])), audio_path: undefined, stems: undefined };
}

export async function GET(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);
  if (!acesso.podeVer) return NextResponse.json({ error: "Acesso restrito ao ministerio de Louvor." }, { status: 403 });
  // A biblioteca atualiza enquanto há uma tarefa pendente. Aproveite a leitura
  // para revelar uma queda do worker, sem esperar outro worker consultar a fila.
  await Promise.all([limparProjetosExpirados(), recuperarProcessamentosLouvorTravados()]);
  let { data, error } = await louvorStudioAdmin.from("louvor_studio_projetos")
    .select("*, escalas(id, culto, data, horario), musicas(tom)").or(`visibilidade.eq.equipe,criado_por.eq.${user.id}`).order("criado_em", { ascending: false }).limit(40);
  if (error && ["PGRST204", "42703"].includes(error.code)) {
    ({ data, error } = await louvorStudioAdmin.from("louvor_studio_projetos")
      .select("*, escalas(id, culto, data, horario), musicas(tom)").order("criado_em", { ascending: false }).limit(40));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data ?? []).map((projeto) => projeto.id);
  const usosPorProjeto = new Map<string, UsoDaEscala[]>();
  if (ids.length) {
    const { data: usos, error: usosError } = await louvorStudioAdmin.from("escala_musicas").select("escala_id,musica_id,studio_projeto_id").in("studio_projeto_id", ids);
    if (!usosError) for (const uso of (usos ?? []) as UsoDaEscala[]) {
      const lista = usosPorProjeto.get(uso.studio_projeto_id) ?? [];
      lista.push(uso); usosPorProjeto.set(uso.studio_projeto_id, lista);
    }
  }
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  let consultaEscalas = louvorStudioAdmin.from("escalas")
    .select("id, culto, data, horario, escala_itens(voluntario_id), escala_musicas(musica_id,titulo,artista,tom,bpm,ordem,studio_projeto_id)")
    .eq("ministerio", "Louvor").gte("data", hoje).order("data").order("horario").limit(30);
  if (!acesso.podeGerenciar) consultaEscalas = consultaEscalas.eq("visivel", true);
  const { data: proximas, error: erroEscalas } = await consultaEscalas;
  if (erroEscalas) console.error("Nao foi possivel carregar os proximos cultos do Studio:", erroEscalas.message);
  const escalas = (proximas ?? [])
    .filter((escala) => acesso.podeGerenciar || escala.escala_itens?.some((item) => item.voluntario_id === user.id))
    .map((escala) => ({
      id: escala.id, culto: escala.culto, data: escala.data, horario: escala.horario,
      escala_musicas: [...(escala.escala_musicas ?? [])].sort((a, b) => a.ordem - b.ordem),
    }));
  return NextResponse.json({ projetos: await Promise.all((data ?? []).map(async (p) => ({ ...(await assinarProjeto(p as ProjetoRow)), escala_usos: usosPorProjeto.get(p.id) ?? [] }))), escalas });
}

export async function POST(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const acesso = await getLouvorStudioAccess(user.id);
  if (!acesso.podeVer) return NextResponse.json({ error: "Acesso restrito ao ministerio de Louvor." }, { status: 403 });
  if (!acesso.podeGerenciar) return NextResponse.json({ error: "Somente ministros e lideres podem preparar musicas no Studio." }, { status: 403 });
  if (!workerConfigurado()) return NextResponse.json({ error: "Configure LOUVOR_STUDIO_WORKER_SECRET na Vercel." }, { status: 503 });
  const body = (await req.json().catch(() => null) ?? {}) as { url?: string; titulo?: string; artista?: string; thumbnailUrl?: string; escalaId?: string; musicaId?: string; tomAlvo?: string | null };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!youtubeUrlValida(url) || !youtubeId(url)) return NextResponse.json({ error: "Use um link valido do YouTube." }, { status: 400 });
  const escalaId = typeof body.escalaId === "string" ? body.escalaId.trim() : "";
  const musicaId = typeof body.musicaId === "string" ? body.musicaId.trim() : "";
  if (!acesso.podeGerenciar && (escalaId || musicaId)) return NextResponse.json({ error: "Somente ministros e lideres podem preparar musicas para uma escala." }, { status: 403 });
  if (musicaId && !uuidValido(musicaId)) return NextResponse.json({ error: "Musica do Repertorio invalida." }, { status: 400 });
  let tomDaCifra: string | null = null;
  if (musicaId) {
    const { data: musica } = await louvorStudioAdmin.from("musicas").select("tom").eq("id", musicaId).maybeSingle();
    if (typeof musica?.tom === "string" && /^[A-G](?:#|b)?m?$/.test(musica.tom)) tomDaCifra = musica.tom;
  }
  let escala: { id: string; ministerio: string } | null = null;
  if (escalaId) {
    const { data: escalaEncontrada } = await louvorStudioAdmin.from("escalas").select("id, ministerio").eq("id", escalaId).maybeSingle();
    escala = escalaEncontrada;
    if (musicaId && escala?.id) {
      const { data: musicaDaEscala } = await louvorStudioAdmin.from("escala_musicas").select("id").eq("escala_id", escala.id).eq("musica_id", musicaId).maybeSingle();
      if (!musicaDaEscala) return NextResponse.json({ error: "Essa musica nao faz parte do set deste culto." }, { status: 400 });
    }
    if (!escala || escala.ministerio !== "Louvor") return NextResponse.json({ error: "Escala de Louvor invalida." }, { status: 400 });
  }
  const ensaioPessoal = !acesso.podeGerenciar;
  const visibilidade = ensaioPessoal ? "pessoal" : "equipe";
  const expiraEm = expiraEmDias(ensaioPessoal ? DIAS_ENSAIO_PESSOAL : DIAS_BIBLIOTECA);
  if (escala && musicaId) {
    const { data: existente } = await louvorStudioAdmin.from("louvor_studio_projetos").select("*").eq("musica_id", musicaId).eq("status", "concluido").eq("visibilidade", "equipe").gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (existente) {
      const { error: vinculoError } = await louvorStudioAdmin.from("escala_musicas").update({ studio_projeto_id: existente.id }).eq("escala_id", escala.id).eq("musica_id", musicaId);
      if (!vinculoError) {
        await louvorStudioAdmin.from("louvor_studio_projetos").update({ expira_em: expiraEmDias(DIAS_BIBLIOTECA), ultimo_uso_em: new Date().toISOString() }).eq("id", existente.id);
        return NextResponse.json({ projeto: existente, reutilizado: true });
      }
    }
  }
  const { data: baseDaEquipe } = await louvorStudioAdmin.from("louvor_studio_projetos").select("*").eq("youtube_url", url).eq("status", "concluido").eq("visibilidade", "equipe").gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (baseDaEquipe && !escala) {
    await louvorStudioAdmin.from("louvor_studio_projetos").update({ expira_em: expiraEmDias(DIAS_BIBLIOTECA), ultimo_uso_em: new Date().toISOString() }).eq("id", baseDaEquipe.id);
    return NextResponse.json({ projeto: baseDaEquipe, reutilizado: true });
  }
  if (ensaioPessoal) {
    const { data: ensaioExistente } = await louvorStudioAdmin.from("louvor_studio_projetos").select("*").eq("youtube_url", url).eq("criado_por", user.id).eq("visibilidade", "pessoal").gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (ensaioExistente) return NextResponse.json({ projeto: ensaioExistente, reutilizado: true });
  }
  if (ensaioPessoal) {
    const [total, processando] = await Promise.all([
      louvorStudioAdmin.from("louvor_studio_projetos").select("id", { count: "exact", head: true })
        .eq("criado_por", user.id).eq("visibilidade", "pessoal").gt("expira_em", new Date().toISOString()),
      louvorStudioAdmin.from("louvor_studio_projetos").select("id", { count: "exact", head: true })
        .eq("criado_por", user.id).eq("visibilidade", "pessoal").in("status", ["aguardando", "baixando", "analisando", "separando"]),
    ]);
    if ((total.count ?? 0) >= 3) return NextResponse.json({ error: "Voce atingiu o limite de 3 ensaios pessoais. Exclua um ou aguarde a expiracao para preparar outra musica." }, { status: 429 });
    if ((processando.count ?? 0) >= 2) return NextResponse.json({ error: "Voce ja tem dois ensaios pessoais em preparacao. Aguarde um terminar." }, { status: 429 });
  } else {
    const { count } = await louvorStudioAdmin.from("louvor_studio_projetos").select("id", { count: "exact", head: true })
      .eq("criado_por", user.id).eq("visibilidade", "equipe").in("status", ["aguardando", "baixando", "analisando", "separando"]);
    if ((count ?? 0) >= 3) return NextResponse.json({ error: "Aguarde as musicas em processamento." }, { status: 429 });
  }
  const { data: projeto, error } = await louvorStudioAdmin.from("louvor_studio_projetos").insert({
    criado_por: user.id, separation_mode: MODELO_COMPLETO, visibilidade, ultimo_uso_em: new Date().toISOString(), pipeline_version: 2,
    escala_id: escala?.id ?? null, musica_id: musicaId || null, youtube_url: url,
    titulo: (typeof body.titulo === "string" ? body.titulo.trim() : "") || "Processando musica",
    artista: (typeof body.artista === "string" ? body.artista.trim() : "") || null, thumbnail_url: body.thumbnailUrl || null,
    // A cifra confirmada no Repertório é a referência musical da preparação.
    // A análise automática fica apenas com BPM/grade de batidas.
    tom_original: tomDaCifra,
    tom_alvo: typeof body.tomAlvo === "string" ? body.tomAlvo.trim() || null : null, expira_em: expiraEm, status: "aguardando", progresso: 0, erro: null,
  }).select("*").single();
  if (error && ["PGRST204", "42703"].includes(error.code)) return NextResponse.json({ error: "Aplique a migration 20260920_louvor_studio_ensaios_pessoais.sql no Supabase." }, { status: 503 });
  if (error || !projeto) return NextResponse.json({ error: error?.message ?? "Nao foi possivel criar a tarefa." }, { status: 500 });
  if (escala && musicaId) await louvorStudioAdmin.from("escala_musicas").update({ studio_projeto_id: projeto.id }).eq("escala_id", escala.id).eq("musica_id", musicaId);
  if (musicaId && acesso.podeGerenciar) {
    const { error: repertorioError } = await louvorStudioAdmin.from("musicas").update({ link_youtube: url }).eq("id", musicaId);
    if (repertorioError) console.error("Nao foi possivel salvar o video no Repertorio:", repertorioError.message);
  }
  return NextResponse.json({ projeto }, { status: 202 });
}
