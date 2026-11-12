export function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}

export function correspondePesquisa(nome: string, busca: string): boolean {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  return normalizar(nome).includes(normalizar(busca));
}
