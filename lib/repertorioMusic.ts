import type { Musica } from "@/types";

const SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BEMOIS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const TONS_REPERTORIO = [...SUSTENIDOS, "Db", "Eb", "Gb", "Ab", "Bb"]
  .flatMap((nota) => [nota, `${nota}m`]);
const ACORDE = /^[A-G][#b]?(?:(?:maj|min|dim|aug|sus|add|m|M|º|°|ø)|[0-9+#b()\-])*?(?:\/[A-G][#b]?)?$/;

export function linhaDeTab(linha: string) {
  return /^\s*[EBGDAe]\s*\|/.test(linha) || /^\s*\[Tab(?:\]|[\s-])/i.test(linha)
    || /^\s*Parte\s+\d+\s+de\s+\d+/i.test(linha);
}

function linhaDeAcordes(linha: string) {
  const palavras = linha.trim().split(/\s+/).filter(Boolean);
  return palavras.length > 0 && palavras.filter((palavra) => ACORDE.test(palavra)).length / palavras.length >= 0.55;
}

export function materiaisDaMusica(musica: Pick<Musica, "cifra" | "tom">) {
  const linhas = (musica.cifra ?? "").split("\n").filter((linha) => !linhaDeTab(linha));
  const cifra = linhas.some((linha) => linhaDeAcordes(linha) || /\[([A-G][#b]?[^\]]*)\]/g.test(linha) &&
    [...linha.matchAll(/\[([^\]]+)\]/g)].some((match) => ACORDE.test(match[1])));
  const letra = linhas.some((linha) => /[a-záàâãéêíóôõúç]/i.test(linha.replace(/\[[^\]]*\]/g, "")) && !linhaDeAcordes(linha));
  return { letra, cifra, transposicao: cifra && indiceNota(musica.tom ?? "") >= 0 };
}

function indiceNota(nota: string) {
  const raiz = nota.replace(/m$/, "");
  const indice = SUSTENIDOS.indexOf(raiz);
  return indice < 0 ? BEMOIS.indexOf(raiz) : indice;
}

export function transporCifra(conteudo: string, origem: string, destino: string) {
  const de = indiceNota(origem), para = indiceNota(destino);
  if (de < 0 || para < 0 || origem === destino) return conteudo;
  const intervalo = (para - de + 12) % 12;
  const notas = destino.includes("b") ? BEMOIS : SUSTENIDOS;
  const transpor = (acorde: string) => !ACORDE.test(acorde) ? acorde : acorde.replace(
    /(^|\/)([A-G][#b]?)/g, (_, prefixo: string, nota: string) => prefixo + notas[(indiceNota(nota) + intervalo) % 12],
  );
  return conteudo.split("\n").map((linha) => {
    if (linhaDeTab(linha)) return linha;
    if (linhaDeAcordes(linha)) return linha.replace(/\S+/g, transpor);
    return linha.replace(/\[([^\]]+)\]/g, (inteiro, acorde: string) => ACORDE.test(acorde) ? `[${transpor(acorde)}]` : inteiro);
  }).join("\n");
}

/** O banco usa snake_case; a interface do catálogo usa camelCase. */
export function musicaDoBanco(row: Record<string, unknown>): Musica {
  const texto = (campo: string, legado?: string) => {
    const valor = row[campo] ?? (legado ? row[legado] : undefined);
    return typeof valor === "string" ? valor : undefined;
  };
  return {
    id: String(row.id), titulo: texto("titulo") ?? "", artista: texto("artista") ?? "",
    tom: texto("tom"), cifra: texto("cifra"), estilo: texto("estilo"),
    linkYoutube: texto("link_youtube", "linkYoutube"), cifraUrl: texto("cifra_url", "cifraUrl"),
    cifraArtistaSlug: texto("cifra_artista_slug", "cifraArtistaSlug"),
    cifraMusicaSlug: texto("cifra_musica_slug", "cifraMusicaSlug"),
    formaDaCifra: texto("forma_da_cifra", "formaDaCifra"), capotraste: texto("capotraste"),
    arquivada: Boolean(row.arquivada),
  };
}
