import type { Escala, ItemEscala } from "@/types";

function horario(value?: string) {
  return String(value ?? "").slice(0, 5);
}

function assinaturaPorPessoa(itens: ItemEscala[]) {
  const mapa = new Map<string, string[]>();
  for (const item of itens) {
    if (!item.voluntarioId) continue;
    const atual = mapa.get(item.voluntarioId) ?? [];
    atual.push(`${item.funcao}|${item.observacao ?? ""}`);
    mapa.set(item.voluntarioId, atual);
  }
  return new Map([...mapa].map(([id, valores]) => [id, valores.sort().join(";;")]));
}

function assinaturaMusicas(escala: Partial<Escala>) {
  return JSON.stringify((escala.musicas ?? []).map((m) => ({
    id: m.musicaId,
    titulo: m.titulo,
    artista: m.artista,
    tom: m.tom ?? "",
    bpm: m.bpm ?? null,
  })));
}

/** Identifica se a mudança afeta a escala toda ou pessoas específicas. */
export function analisarAlteracoesEscala(anterior: Escala | undefined, proxima: Partial<Escala>) {
  if (!anterior) return { geral: true, afetados: [] as string[] };

  const geral =
    anterior.culto !== proxima.culto ||
    anterior.data !== proxima.data ||
    horario(anterior.horario) !== horario(proxima.horario) ||
    (anterior.observacoes ?? "") !== (proxima.observacoes ?? "") ||
    ("confirmacaoParticipantes" in proxima &&
      Boolean(anterior.confirmacaoParticipantes) !== Boolean(proxima.confirmacaoParticipantes)) ||
    assinaturaMusicas(anterior) !== assinaturaMusicas(proxima);

  const antes = assinaturaPorPessoa(anterior.itens);
  const depois = assinaturaPorPessoa(proxima.itens ?? []);
  const ids = new Set([...antes.keys(), ...depois.keys()]);
  const afetados = [...ids].filter((id) => antes.get(id) !== depois.get(id));
  return { geral, afetados };
}

/** Preserva respostas inalteradas e reseta apenas o escopo impactado. */
export function prepararConfirmacoes(
  itens: ItemEscala[],
  anteriores: ItemEscala[],
  geral: boolean,
  afetados: string[],
) {
  const afetadosSet = new Set(afetados);
  const anterioresPorChave = new Map(
    anteriores.map((item) => [`${item.voluntarioId}|${item.funcao}|${item.observacao ?? ""}`, item]),
  );

  return itens.map((item) => {
    const deveResetar = geral || !item.voluntarioId || afetadosSet.has(item.voluntarioId);
    if (deveResetar) {
      return { ...item, confirmado: false, confirmadoEm: undefined, confirmacaoStatus: "pendente" as const };
    }
    const anterior = anterioresPorChave.get(`${item.voluntarioId}|${item.funcao}|${item.observacao ?? ""}`);
    return anterior ? {
      ...item,
      confirmado: anterior.confirmado,
      confirmadoEm: anterior.confirmadoEm,
      confirmacaoStatus: anterior.confirmacaoStatus,
    } : item;
  });
}
