import { NextRequest, NextResponse } from "next/server";
import { getLouvorStudioUser, podeGerenciarLouvorStudio } from "@/lib/louvorStudioServer";

function duracaoEmSegundos(value: string | undefined) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function youtubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    if (parsed.hostname.endsWith("youtube.com")) return parsed.searchParams.get("v");
  } catch { /* pesquisa comum */ }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!(await podeGerenciarLouvorStudio(user.id))) {
    return NextResponse.json({ error: "Somente ministros e líderes podem adicionar músicas." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { query?: string } | null;
  const query = body?.query?.trim();
  if (!query || query.length < 2) return NextResponse.json({ error: "Informe uma música para pesquisar." }, { status: 400 });

  const idDireto = youtubeId(query);
  if (idDireto) {
    try {
      const url = "https://www.youtube.com/watch?v=" + encodeURIComponent(idDireto);
      const response = await fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent(url) + "&format=json", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const item = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
      return NextResponse.json({ resultados: [{
        id: idDireto, titulo: item.title ?? "Vídeo do YouTube", artista: item.author_name ?? "YouTube",
        url, thumbnailUrl: item.thumbnail_url,
      }] });
    } catch {
      return NextResponse.json({ error: "Não foi possível confirmar esse link do YouTube." }, { status: 400 });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "A pesquisa por nome ainda precisa da YOUTUBE_API_KEY. Enquanto isso, cole o link do vídeo do YouTube.",
    }, { status: 503 });
  }
  try {
    const params = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "8", q: query.slice(0, 120), key: apiKey,
    });
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), { cache: "no-store" });
    const payload = await response.json() as {
      items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }[];
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message ?? "A pesquisa do YouTube falhou.");

    const ids = (payload.items ?? []).map((item) => item.id?.videoId).filter(Boolean) as string[];
    const durations = new Map<string, number>();
    if (ids.length) {
      const videoParams = new URLSearchParams({ part: "contentDetails", id: ids.join(","), key: apiKey });
      const videoResponse = await fetch("https://www.googleapis.com/youtube/v3/videos?" + videoParams.toString(), { cache: "no-store" });
      if (videoResponse.ok) {
        const videos = await videoResponse.json() as { items?: { id: string; contentDetails?: { duration?: string } }[] };
        videos.items?.forEach((video) => {
          const seconds = duracaoEmSegundos(video.contentDetails?.duration);
          if (seconds) durations.set(video.id, seconds);
        });
      }
    }
    return NextResponse.json({ resultados: (payload.items ?? []).flatMap((item) => {
      const id = item.id?.videoId;
      if (!id) return [];
      return [{
        id,
        titulo: item.snippet?.title ?? "Sem título",
        artista: item.snippet?.channelTitle ?? "YouTube",
        duracao: durations.get(id),
        url: "https://www.youtube.com/watch?v=" + id,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg",
      }];
    }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "A pesquisa falhou." }, { status: 502 });
  }
}
