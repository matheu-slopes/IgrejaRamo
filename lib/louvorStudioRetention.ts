/** Keep service audio through the entire service day in Brasilia (UTC-03). */
export function expiracaoAposCulto(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data do culto invalida.");
  const [ano, mes, dia] = data.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, dia));
  if (inicio.toISOString().slice(0, 10) !== data) throw new Error("Data do culto invalida.");
  return new Date(Date.UTC(ano, mes - 1, dia + 1, 3)).toISOString();
}

export function expiracaoAoVincularCulto(data: string, expiracaoAtual?: string | null): string {
  const nova = expiracaoAposCulto(data);
  // SQL triggers are the source of truth for all links. This also protects an
  // already linked later service while the API adds an earlier service.
  return expiracaoAtual && Date.parse(expiracaoAtual) > Date.parse(nova) ? expiracaoAtual : nova;
}
