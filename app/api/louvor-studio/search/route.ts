import { NextRequest, NextResponse } from "next/server";
import { getLouvorStudioAccess, getLouvorStudioUser } from "@/lib/louvorStudioServer";
import { searchYoutube, youtubeId, youtubeLinkResult } from "@/lib/youtubeSearch";
import { withDeadline } from "@/lib/withDeadline";

export const maxDuration = 25;

export async function POST(req: NextRequest) {
  try {
    return await withDeadline(async (signal) => {
      const user = await getLouvorStudioUser(req);
      signal.throwIfAborted();
      if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      if (!(await getLouvorStudioAccess(user.id)).podeVer) {
        return NextResponse.json({ error: "Somente ministros e líderes podem adicionar músicas." }, { status: 403 });
      }
      signal.throwIfAborted();
      const body = await req.json().catch(() => null) as { query?: unknown } | null;
      const query = typeof body?.query === "string" ? body.query.trim() : "";
      if (query.length < 2 || query.length > 500) {
        return NextResponse.json({ error: "Informe o nome da música ou um link do YouTube (até 500 caracteres)." }, { status: 400 });
      }

      const id = youtubeId(query);
      if (id) return NextResponse.json({ resultados: [await youtubeLinkResult(id, signal)] });
      if (/^https?:\/\//i.test(query)) {
        return NextResponse.json({ error: "Informe um link válido de vídeo do YouTube ou pesquise pelo nome." }, { status: 400 });
      }
      const resultados = await searchYoutube(query.slice(0, 120), signal, process.env.YOUTUBE_API_KEY);
      return NextResponse.json({ resultados });
    }, 18_000);
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json({
      error: timeout
        ? "O YouTube demorou para responder. Tente novamente ou cole o link do vídeo."
        : "Não foi possível consultar o YouTube agora. Tente novamente ou cole o link do vídeo.",
    }, { status: timeout ? 504 : 502 });
  }
}
