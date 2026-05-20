import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

function toSlug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** GET /api/buscar-cifra?artista=hillsong&musica=oceans  → busca cifra */
/** GET /api/buscar-cifra?q=oceans hillsong               → sugestões de busca */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q       = searchParams.get("q")?.trim();
  const artista = searchParams.get("artista")?.trim();
  const musica  = searchParams.get("musica")?.trim();

  // ── Modo busca de sugestões ───────────────────────────────────────
  if (q) {
    type Sugestao = { titulo: string; artista: string; url: string; artistaSlug: string; musicaSlug: string };
    const IGNORAR = new Set(["pesquisar","cifras","artistas","videos","forum","comunidade","tabs","partituras","musicas","estilos","letras","guitarra","violao","contra-baixo","keyboard"]);
    const SUFIXOS_IGNORAR = /\.(html|php|asp)$|\/letra\/|\/simplificada|\/videos?\/|\/imprimir\//i;

    function parseSugestao(artistaSlug: string, musicaSlug: string, titleHint: string): Sugestao | null {
      if (IGNORAR.has(artistaSlug) || IGNORAR.has(musicaSlug) || musicaSlug.length < 2) return null;
      if (SUFIXOS_IGNORAR.test(musicaSlug)) return null;
      const partes = titleHint.split(/\s*[-–|]\s*/);
      const titulo      = partes[0]?.trim() || musicaSlug.replace(/-/g, " ");
      const artistaNome = partes[1]?.trim() || artistaSlug.replace(/-/g, " ");
      return { titulo, artista: artistaNome,
        url: `https://www.cifraclub.com.br/${artistaSlug}/${musicaSlug}/`,
        artistaSlug, musicaSlug };
    }

    /** DuckDuckGo HTML search — melhor indexação, pode bloquear sob carga */
    async function ddgSearch(query: string): Promise<Sugestao[]> {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const html = await res.text();
      // Se DDG bloqueou, retorna página genérica (<14 kB)
      if (html.length < 20000) return [];
      const $ = cheerio.load(html);
      const results: Sugestao[] = [];
      const seen = new Set<string>();
      $("a[href*='uddg']").each((_, el) => {
        const href = $(el).attr("href") || "";
        const m = href.match(/uddg=([^&]+)/);
        if (!m) return;
        let decoded: string;
        try { decoded = decodeURIComponent(m[1]); } catch { return; }
        if (!decoded.includes("cifraclub.com.br")) return;
        const pm = decoded.match(/cifraclub\.com\.br\/([^/?#\s]+)\/([^/?#\s]+)/);
        if (!pm) return;
        const key = `${pm[1]}/${pm[2]}`;
        if (seen.has(key)) return;
        seen.add(key);
        const s = parseSugestao(pm[1], pm[2], $(el).text().trim());
        if (s) results.push(s);
      });
      return results;
    }

    /** Bing RSS — mais confiável, indexação um pouco menor */
    async function bingRSS(query: string): Promise<Sugestao[]> {
      const res = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}&count=10`, {
        headers: { "User-Agent": HEADERS["User-Agent"], Accept: "application/rss+xml, text/xml, */*", "Accept-Language": "pt-BR,pt;q=0.9" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const xml = await res.text();
      const $x = cheerio.load(xml, { xmlMode: true });
      const results: Sugestao[] = [];
      const seen = new Set<string>();
      $x("item").each((_, el) => {
        const link  = $x(el).find("link").text().trim();
        const title = $x(el).find("title").text().trim();
        const desc  = $x(el).find("description").text().trim();
        for (const s of [link, desc]) {
          const pm = s.match(/cifraclub\.com\.br\/([^/?#\s"<]+)\/([^/?#\s"<]+)/);
          if (!pm) continue;
          const key = `${pm[1]}/${pm[2]}`;
          if (seen.has(key)) break;
          seen.add(key);
          const sg = parseSugestao(pm[1], pm[2], title);
          if (sg) results.push(sg);
          break;
        }
      });
      return results;
    }

    /** Google Custom Search Engine — usa o mesmo motor que o Cifra Club
     *  Requer GOOGLE_CSE_KEY no .env.local (100 req/dia grátis)
     *  CX ID extraído dos bundles JS do próprio Cifra Club */
    const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY;
    const BRAVE_KEY      = process.env.BRAVE_SEARCH_KEY;
    const SERPER_KEY     = process.env.SERPER_API_KEY;
    const CIFRACLUB_CX   = "61f1de5bfbfd04aa1";

    /** Serper.dev — Google Search real, 2500 buscas/mês grátis, sem cartão */
    async function serperSearch(query: string): Promise<Sugestao[]> {
      if (!SERPER_KEY) return [];
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 20, gl: "br", hl: "pt" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results: Sugestao[] = [];
      const seen = new Set<string>();
      for (const item of [...(data.organic ?? []), ...(data.sitelinks?.inline ?? [])]) {
        const link: string = item.link ?? "";
        const pm = link.match(/cifraclub\.com\.br\/([^/?#\s]+)\/([^/?#\s]+)/);
        if (!pm) continue;
        const key = `${pm[1]}/${pm[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = parseSugestao(pm[1], pm[2], item.title ?? "");
        if (s) results.push(s);
      }
      return results;
    }

    /** Brave Search API — 2000 buscas/mês grátis, ótima cobertura */
    async function braveSearch(query: string): Promise<Sugestao[]> {
      if (!BRAVE_KEY) return [];
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results: Sugestao[] = [];
      const seen = new Set<string>();
      for (const item of (data.web?.results ?? [])) {
        const link: string = item.url ?? "";
        const pm = link.match(/cifraclub\.com\.br\/([^/?#\s]+)\/([^/?#\s]+)/);
        if (!pm) continue;
        const key = `${pm[1]}/${pm[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = parseSugestao(pm[1], pm[2], item.title ?? "");
        if (s) results.push(s);
      }
      return results;
    }

    async function googleCSE(query: string): Promise<Sugestao[]> {
      if (!GOOGLE_CSE_KEY) return [];
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${CIFRACLUB_CX}&q=${encodeURIComponent(query)}&num=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json();
      const results: Sugestao[] = [];
      const seen = new Set<string>();
      for (const item of (data.items ?? [])) {
        const link: string = item.link ?? "";
        const pm = link.match(/cifraclub\.com\.br\/([^/?#\s]+)\/([^/?#\s]+)/);
        if (!pm) continue;
        const key = `${pm[1]}/${pm[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = parseSugestao(pm[1], pm[2], item.title ?? "");
        if (s) results.push(s);
      }
      return results;
    }

    // ── Cache Supabase ────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const CACHE_TTL_DAYS = 30;
    const qNorm = q.toLowerCase().trim();

    // Tenta retornar do cache primeiro
    const { data: cached } = await supabaseAdmin
      .from("busca_cache")
      .select("results, created_at")
      .eq("query", qNorm)
      .single();

    if (cached) {
      const age = (Date.now() - new Date(cached.created_at).getTime()) / 86_400_000;
      if (age < CACHE_TTL_DAYS) {
        return NextResponse.json({ results: cached.results, cached: true });
      }
    }

    try {
      const seen = new Set<string>();
      const merged: Sugestao[] = [];

      function addAll(items: Sugestao[]) {
        for (const item of items) {
          const key = `${item.artistaSlug}/${item.musicaSlug}`;
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
      }

      // Prioridade: Serper (Google real) → Brave → Google CSE → DDG + Bing
      if (SERPER_KEY) {
        const [s1, s2] = await Promise.all([
          serperSearch(`site:cifraclub.com.br ${q}`),
          serperSearch(`${q} cifra cifraclub`),
        ]);
        addAll(s1);
        addAll(s2);
      } else if (BRAVE_KEY) {
        const [b1, b2] = await Promise.all([
          braveSearch(`site:cifraclub.com.br ${q}`),
          braveSearch(`${q} site:cifraclub.com.br cifra`),
        ]);
        addAll(b1);
        addAll(b2);
      } else if (GOOGLE_CSE_KEY) {
        const [cse1, cse2] = await Promise.all([
          googleCSE(q),
          googleCSE(`${q} cifra`),
        ]);
        addAll(cse1);
        addAll(cse2);
      }

      // Complementa com DDG + Bing (ou usa como primário se sem chave)
      if (merged.length < 8) {
        const [ddg1, ddg2, bing1] = await Promise.all([
          ddgSearch(`site:cifraclub.com.br ${q}`),
          ddgSearch(`${q} site:cifraclub.com.br cifra`),
          bingRSS(`site:cifraclub.com.br ${q}`),
        ]);
        addAll(ddg1);
        addAll(ddg2);
        addAll(bing1);
      }

      const final = merged.slice(0, 15);

      // Salva no cache (upsert — atualiza se já existia)
      if (final.length > 0) {
        await supabaseAdmin.from("busca_cache").upsert(
          { query: qNorm, results: final },
          { onConflict: "query" }
        );
      }

      return NextResponse.json({ results: final });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  // ── Modo busca de cifra ───────────────────────────────────────────
  if (!artista || !musica) {
    return NextResponse.json(
      { error: "Informe 'artista' e 'musica' ou o parâmetro 'q' para busca." },
      { status: 400 }
    );
  }

  const artistaSlug = toSlug(artista);
  const musicaSlug  = toSlug(musica);
  const cifraUrl    = `https://www.cifraclub.com.br/${artistaSlug}/${musicaSlug}/`;

  const CIFRACLUB_API_URL = process.env.CIFRACLUB_API_URL;
  let res: Response | null = null;
  let useFallback = false;

  try {
    res = await fetch(cifraUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      if (CIFRACLUB_API_URL) {
        useFallback = true;
      }
    }
  } catch (err) {
    if (CIFRACLUB_API_URL) {
      useFallback = true;
    } else {
      return NextResponse.json({ error: "Timeout ao acessar o Cifra Club." }, { status: 504 });
    }
  }

  if (useFallback && CIFRACLUB_API_URL) {
    try {
      const fallbackUrl = `${CIFRACLUB_API_URL}/artists/${artistaSlug}/songs/${musicaSlug}`;
      const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(20000) });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data && !data.error && data.cifra) {
          return NextResponse.json({
            artist:       data.artist || artista,
            name:         data.name || musica,
            tom_original: data.tom_original || null,
            youtube_url:  data.youtube_url || null,
            cifraclub_url: cifraUrl,
            cifra:        data.cifra,
          });
        }
      }
    } catch (fallbackErr) {
      console.error("Erro ao acessar a API fallback do Cifra Club:", fallbackErr);
    }
  }

  if (!res || !res.ok) {
    const status = res?.status || 500;
    if (status === 403 || status === 503) {
      return NextResponse.json(
        { error: "O Cifra Club bloqueou a requisição do servidor (Cloudflare). Tente configurar a API local ou pesquise novamente mais tarde." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: `Música não encontrada. Verifique o nome do artista ("${artista}") e da música ("${musica}").` },
      { status: 404 }
    );
  }


  const html = await res.text();
  const $ = cheerio.load(html);

  // Cifra fica dentro de #cifra_cnt > pre
  let cifraTexto = $("#cifra_cnt pre").first().text();

  // Fallback: qualquer <pre> com conteúdo de acordes
  if (!cifraTexto) {
    $("pre").each((_, el) => {
      const t = $(el).text();
      if (t.length > 100 && !cifraTexto) cifraTexto = t;
    });
  }

  if (!cifraTexto || cifraTexto.trim().length < 20) {
    return NextResponse.json(
      { error: "Cifra não encontrada. A música pode não ter cifra disponível ou o nome está incorreto." },
      { status: 404 }
    );
  }

  // Metadados
  const titulo      = $("h1.t1").text().trim() || $("h1").first().text().trim() || musica;
  const artistaNome = $("h2.t3 a").first().text().trim() || $(".bread a").last().text().trim() || artista;

  // YouTube e Tom (vêm em JSON embutido no HTML)
  let youtubeUrl = "";
  let tomOriginal = "";
  const scripts = $("script:not([src])").map((_, el) => $(el).html() ?? "").get().join("\n");

  const ytMatch = scripts.match(/"(?:youtube_id|youtubeId)"\s*:\s*"([A-Za-z0-9_-]{10,12})"/);
  if (ytMatch) youtubeUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;

  // Tom: tenta extrair do HTML (vários seletores + variáveis JS)
  const tomEl = $(
    ".cifra_tom a, .tom_atual, [data-cy='cifra-tom'] a, " +
    "#cifra_tom, .g-song-key, [class*='tom'] a, " +
    "[class*='key'] a, [data-key], .cifra-tom"
  ).first().text().trim().replace(/^tom:?\s*/i, "");
  if (tomEl && /^[A-G][#b]?m?$/.test(tomEl)) {
    tomOriginal = tomEl;
  } else {
    // Tenta regex no JSON embutido no HTML
    const tomMatch =
      scripts.match(/"tom"\s*:\s*"([A-G][#b]?m?[0-9]*)"/) ||
      scripts.match(/"key"\s*:\s*"([A-G][#b]?m?)"/) ||
      scripts.match(/tom:\s*["']([A-G][#b]?m?[0-9]*)["']/);
    if (tomMatch) tomOriginal = tomMatch[1].replace(/[0-9]+$/, "");
  }

  return NextResponse.json({
    artist:       artistaNome,
    name:         titulo,
    tom_original: tomOriginal || null,
    youtube_url:  youtubeUrl || null,
    cifraclub_url: cifraUrl,
    cifra:        cifraTexto.split("\n"),
  });
}
