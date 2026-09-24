import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]+$/;
const TOM_RE = /^[A-G](?:#|b)?m?$/;

type NovaMusica = {
  id?: string;
  titulo?: string;
  artista?: string;
  tom?: string | null;
  link_youtube?: string | null;
  cifra?: string | null;
  cifra_url?: string | null;
  cifra_artista_slug?: string;
  cifra_musica_slug?: string;
  forma_da_cifra?: string | null;
  capotraste?: string | null;
};

function erroDeColunaAusente(error: { code?: string; message?: string } | null) {
  const mensagem = String(error?.message ?? "").toLowerCase();
  return error?.code === "PGRST204" || error?.code === "42703" || mensagem.includes("schema cache");
}

function respostaErro(error: string, status: number, requestId: string) {
  return NextResponse.json({ ok: false, error, requestId }, { status });
}

async function comPrazo<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Tempo limite excedido.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  if (!supabaseUrl || !serviceRoleKey) {
    return respostaErro("Configuracao do servidor ausente.", 500, requestId);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respostaErro("Sessao nao encontrada.", 401, requestId);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authResult: Awaited<ReturnType<typeof admin.auth.getUser>>;
  try {
    authResult = await comPrazo(admin.auth.getUser(token), 8_000);
  } catch (error) {
    console.error("[repertorio/musicas] autenticacao", requestId, error);
    return respostaErro("A validacao da sessao demorou demais.", 504, requestId);
  }
  const { data: authData, error: authError } = authResult;
  if (authError || !authData.user) return respostaErro("Sessao invalida.", 401, requestId);

  const { data: podeGerenciar, error: permissaoError } = await admin
    .rpc("pode_gerenciar_repertorio_louvor", { p_user: authData.user.id })
    .abortSignal(AbortSignal.timeout(8_000));
  if (permissaoError) {
    console.error("[repertorio/musicas] permissao", requestId, permissaoError.message);
    return respostaErro("Nao foi possivel validar a permissao.", 503, requestId);
  }
  if (!podeGerenciar) return respostaErro("Sem permissao para alterar o Repertorio.", 403, requestId);

  const body = await req.json().catch(() => null) as NovaMusica | null;
  const id = String(body?.id ?? "").trim();
  const titulo = String(body?.titulo ?? "").trim();
  const artista = String(body?.artista ?? "").trim();
  const tom = body?.tom ? String(body.tom).trim() : null;
  const artistaSlug = String(body?.cifra_artista_slug ?? "").trim();
  const musicaSlug = String(body?.cifra_musica_slug ?? "").trim();
  const cifra = typeof body?.cifra === "string" ? body.cifra : null;
  const formaDaCifra = body?.forma_da_cifra ? String(body.forma_da_cifra).trim() : null;
  const capotraste = body?.capotraste ? String(body.capotraste).trim() : null;

  if (!UUID_RE.test(id)) return respostaErro("Identificador da musica invalido.", 400, requestId);
  if (!titulo || titulo.length > 240) return respostaErro("Titulo da musica invalido.", 400, requestId);
  if (!artista || artista.length > 240) return respostaErro("Artista da musica invalido.", 400, requestId);
  if (tom && !TOM_RE.test(tom)) return respostaErro("Tom da musica invalido.", 400, requestId);
  if (!SLUG_RE.test(artistaSlug) || !SLUG_RE.test(musicaSlug)) {
    return respostaErro("Referencia do Cifra Club invalida.", 400, requestId);
  }
  if (cifra && cifra.length > 500_000) return respostaErro("A cifra excede o limite permitido.", 413, requestId);
  if (formaDaCifra && formaDaCifra.length > 30) return respostaErro("Forma da cifra invalida.", 400, requestId);
  if (capotraste && capotraste.length > 30) return respostaErro("Capotraste invalido.", 400, requestId);

  const { data: porId, error: buscaIdError } = await admin
    .from("musicas")
    .select("*")
    .eq("id", id)
    .abortSignal(AbortSignal.timeout(8_000))
    .maybeSingle();
  if (buscaIdError) {
    console.error("[repertorio/musicas] busca-id", requestId, buscaIdError.message);
    return respostaErro("Nao foi possivel confirmar a musica no Repertorio.", 503, requestId);
  }
  if (porId) return NextResponse.json({ ok: true, musica: porId, created: false, requestId });

  const { data: porFonte, error: buscaFonteError } = await admin
    .from("musicas")
    .select("*")
    .eq("cifra_artista_slug", artistaSlug)
    .eq("cifra_musica_slug", musicaSlug)
    .abortSignal(AbortSignal.timeout(8_000))
    .maybeSingle();
  if (!buscaFonteError && porFonte) {
    return NextResponse.json({ ok: true, musica: porFonte, created: false, requestId });
  }

  const dadosComFonte = {
    id,
    titulo,
    artista,
    tom,
    link_youtube: body?.link_youtube || null,
    cifra,
    cifra_url: body?.cifra_url || null,
    cifra_artista_slug: artistaSlug,
    cifra_musica_slug: musicaSlug,
    forma_da_cifra: formaDaCifra,
    capotraste,
  };

  let { data: musica, error } = await admin
    .from("musicas")
    .insert(dadosComFonte)
    .select("*")
    .abortSignal(AbortSignal.timeout(8_000))
    .single();

  if (erroDeColunaAusente(error)) {
    const fallback = await admin
      .from("musicas")
      .insert({ id, titulo, artista, tom })
      .select("*")
      .abortSignal(AbortSignal.timeout(8_000))
      .single();
    musica = fallback.data;
    error = fallback.error;
  }

  if (error?.code === "23505") {
    const confirmado = await admin
      .from("musicas")
      .select("*")
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(8_000))
      .maybeSingle();
    if (confirmado.data) {
      return NextResponse.json({ ok: true, musica: confirmado.data, created: false, requestId });
    }
  }

  if (error || !musica) {
    console.error("[repertorio/musicas] insert", requestId, error?.message ?? "sem retorno");
    return respostaErro("Nao foi possivel salvar a musica no Repertorio.", 503, requestId);
  }

  return NextResponse.json({ ok: true, musica, created: true, requestId }, { status: 201 });
}
