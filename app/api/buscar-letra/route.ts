import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
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

/** GET /api/buscar-letra?artista=<slug>&musica=<slug> */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const artista = searchParams.get("artista")?.trim();
  const musica  = searchParams.get("musica")?.trim();

  if (!artista || !musica) {
    return NextResponse.json({ error: "Parâmetros 'artista' e 'musica' são obrigatórios." }, { status: 400 });
  }

  const url = `https://www.letras.mus.br/${toSlug(artista)}/${toSlug(musica)}/`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json({ error: "Timeout ao acessar letras.mus.br." }, { status: 504 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Letra não encontrada para "${musica}" de "${artista}".` },
      { status: 404 }
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Letras.mus.br usa div.lyric-original ou article.cnt-letra
  let letra = "";

  const container =
    $("div.lyric-original").first() ||
    $("article.cnt-letra").first();

  container.find("p").each((_, p) => {
    const lines = $(p)
      .html()
      ?.replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (lines) letra += lines + "\n\n";
  });

  // Fallback: tenta article.cnt-letra
  if (!letra.trim()) {
    $("article.cnt-letra p").each((_, p) => {
      const lines = $(p)
        .html()
        ?.replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (lines) letra += lines + "\n\n";
    });
  }

  if (!letra.trim()) {
    return NextResponse.json(
      { error: "Letra não encontrada. Verifique o nome da música." },
      { status: 404 }
    );
  }

  const titulo = $("h1.head-title, h1.title, h1").first().text().trim();
  const artistaNome = $("h2.head-subtitle a, h2 a").first().text().trim() || artista;

  return NextResponse.json({
    titulo,
    artista: artistaNome,
    letra: letra.trim(),
    url,
  });
}
