type Participacao = { conversa_id: string; historico_desde?: string | null; ocultado_em?: string | null };
type Cursor = { conversa_id: string; last_read_message_id: string | null };
type MensagemLida = { criado_em: string | null };

/** Limite comum conservador: nunca exclui uma mensagem que pode estar não lida. */
export function inicioSeguroDeMensagens(
  participacoes: Participacao[],
  cursors: Cursor[],
  mensagensLidas: Map<string, MensagemLida>,
): string | null {
  if (!participacoes.length) return null;
  const porConversa = new Map(cursors.map((cursor) => [cursor.conversa_id, cursor]));
  let inicio = Infinity;
  for (const participacao of participacoes) {
    const cursor = porConversa.get(participacao.conversa_id);
    const lida = cursor?.last_read_message_id ? mensagensLidas.get(cursor.last_read_message_id) : null;
    const datas = [participacao.historico_desde, participacao.ocultado_em, lida?.criado_em]
      .filter((valor): valor is string => Boolean(valor))
      .map((valor) => Date.parse(valor));
    if (!datas.length || datas.some((valor) => !Number.isFinite(valor))) return null;
    inicio = Math.min(inicio, Math.max(...datas));
  }
  return new Date(inicio).toISOString();
}
