export function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

// Distância de edição com troca de letras vizinhas (ex.: "viola" / "vioal").
function distancia(a: string, b: string): number {
  const linhas: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const linha = new Array<number>(b.length + 1).fill(0);
    linha[0] = i;
    return linha;
  });
  for (let j = 0; j <= b.length; j++) linhas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      linhas[i][j] = Math.min(linhas[i - 1][j] + 1, linhas[i][j - 1] + 1, linhas[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        linhas[i][j] = Math.min(linhas[i][j], linhas[i - 2][j - 2] + 1);
      }
    }
  }
  return linhas[a.length][b.length];
}

export function correspondePesquisa(nome: string, busca: string): boolean {
  const alvo = normalizar(nome);
  const consulta = normalizar(busca);
  if (alvo.includes(consulta)) return true;
  const palavras = alvo.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const termos = consulta.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!termos.length) return false;
  return termos.every((termo) => palavras.some((palavra) => {
    if (palavra.includes(termo)) return true;
    if (termo.length < 4 || palavra.length < 4) return false;
    const limite = termo.length >= 8 || (termo.length >= 6 && palavra.length >= 8) ? 2 : 1;
    return Math.abs(palavra.length - termo.length) <= limite && distancia(palavra, termo) <= limite;
  }));
}
