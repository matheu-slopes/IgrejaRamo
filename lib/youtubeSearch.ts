import { load } from "cheerio";

export type YoutubeSearchResult = {
  id: string;
  titulo: string;
  artista: string;
  duracao?: number;
  url: string;
  thumbnailUrl: string;
};

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const SEARCH_ERROR = "Não foi possível consultar o YouTube agora. Tente novamente ou cole o link do vídeo.";

export function youtubeId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be") id = path[0];
    if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      id = ["shorts", "live", "embed"].includes(path[0]) ? path[1] : url.searchParams.get("v");
    }
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function youtubeText(value: unknown): string {
  const node = record(value);
  if (typeof node.simpleText === "string") return node.simpleText;
  return Array.isArray(node.runs)
    ? node.runs.map((run) => record(run).text).filter((text) => typeof text === "string").join("")
    : "";
}

function resultForId(id: string): YoutubeSearchResult {
  return {
    id,
    titulo: "Vídeo do YouTube",
    artista: "YouTube",
    url: "https://www.youtube.com/watch?v=" + id,
    thumbnailUrl: "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg",
  };
}

/** Read only search metadata: no player extraction, audio download or pagination. */
export function parseYoutubeSearch(html: string): YoutubeSearchResult[] {
  const $ = load(html);
  let data: Record<string, unknown> | undefined;
  for (const script of $("script").toArray()) {
    const source = $(script).html() ?? "";
    const assignment = /(?:var\s+ytInitialData|window\["ytInitialData"\]|window\['ytInitialData'\])\s*=\s*/.exec(source);
    if (!assignment) continue;
    const json = source.slice(assignment.index + assignment[0].length).trim().replace(/;\s*$/, "");
    try { data = record(JSON.parse(json)); } catch { continue; }
    break;
  }
  // Consent/error pages must not be reported as a successful empty search.
  const contents = record(data?.contents);
  const root = record(contents.twoColumnSearchResultsRenderer).primaryContents
    ?? contents.sectionListRenderer;
  if (!root) throw new Error(SEARCH_ERROR);

  const results = new Map<string, YoutubeSearchResult>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object" || results.size >= 8) return;
    const node = record(value);
    // Exclude sponsored results and playlists; recurse only through search contents.
    if (node.adSlotRenderer || node.promotedSparklesWebRenderer || node.playlistRenderer) return;
    if (node.videoRenderer) {
      const video = record(node.videoRenderer);
      const id = video.videoId;
      const title = youtubeText(video.title);
      if (typeof id !== "string" || !VIDEO_ID.test(id) || !title || results.has(id)) return;
      const length = youtubeText(video.lengthText);
      const duration = /^\d+(?::\d{2}){1,2}$/.test(length)
        ? length.split(":").reduce((total, part) => total * 60 + Number(part), 0)
        : undefined;
      results.set(id, {
        ...resultForId(id), titulo: title,
        artista: youtubeText(video.ownerText ?? video.longBylineText ?? video.shortBylineText) || "YouTube",
        duracao: duration,
      });
      return;
    }
    Object.values(node).forEach(visit);
  }
  visit(root);
  return [...results.values()];
}

async function searchPublicPage(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({ search_query: query, hl: "pt", gl: "BR", sp: "EgIQAQ==" });
  const response = await fetch("https://www.youtube.com/results?" + params, {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
    headers: { "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(SEARCH_ERROR);
  return parseYoutubeSearch(await response.text());
}

async function searchApi(query: string, apiKey: string, signal: AbortSignal) {
  const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "8", q: query, key: apiKey });
  const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params, {
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
  });
  if (!response.ok) throw new Error(SEARCH_ERROR);
  const payload = await response.json() as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[];
  };
  if (!Array.isArray(payload.items)) throw new Error(SEARCH_ERROR);
  // No second request for durations: optional metadata must not delay selection.
  const decode = (text: string) => load(text).text();
  return payload.items.flatMap((item) => {
    const id = item.id?.videoId;
    return id && VIDEO_ID.test(id) ? [{
      ...resultForId(id),
      titulo: decode(item.snippet?.title ?? "Vídeo do YouTube"),
      artista: decode(item.snippet?.channelTitle ?? "YouTube"),
    }] : [];
  });
}

// Bounded, short-lived cache per server instance. Permission checks happen first.
const cache = new Map<string, { expires: number; results: YoutubeSearchResult[] }>();

export async function searchYoutube(query: string, signal: AbortSignal, apiKey?: string) {
  signal.throwIfAborted();
  const key = query.toLocaleLowerCase("pt-BR");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;
  let results: YoutubeSearchResult[];
  if (apiKey) {
    try { results = await searchApi(query, apiKey, signal); }
    catch {
      signal.throwIfAborted();
      results = await searchPublicPage(query, signal);
    }
  } else {
    results = await searchPublicPage(query, signal);
  }
  if (results.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 5 * 60_000, results });
  }
  return results;
}

export async function youtubeLinkResult(id: string, signal: AbortSignal): Promise<YoutubeSearchResult> {
  const fallback = resultForId(id);
  try {
    const response = await fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent(fallback.url) + "&format=json", {
      cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(4_000)]),
    });
    if (!response.ok) return fallback;
    const item = await response.json() as { title?: string; author_name?: string };
    return { ...fallback, titulo: item.title ?? fallback.titulo, artista: item.author_name ?? fallback.artista };
  } catch {
    signal.throwIfAborted();
    return fallback;
  }
}
