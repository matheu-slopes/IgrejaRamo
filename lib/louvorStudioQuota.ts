import "server-only";
import { louvorStudioAdmin as db } from "@/lib/louvorStudioServer";
import { medirEspacoR2 } from "@/lib/louvorStudioStorage";

export const LIMITE_STUDIO_BYTES = 8_000_000_000;
// Bounds four 20-minute FLAC16+MP3 stems and exported mixes at 0.5x speed.
export const RESERVA_PREPARACAO_BYTES = 1_100_000_000;
export class EspacoStudioError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}

export async function reservarEspacoStudio(id: string, bytes = RESERVA_PREPARACAO_BYTES): Promise<void> {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > RESERVA_PREPARACAO_BYTES)
    throw new EspacoStudioError("Tamanho de preparacao invalido.", 400);
  const { data: inicio, error: inicioError } = await db.rpc("louvor_studio_inicio_medicao");
  if (inicioError || typeof inicio !== "string")
    throw new EspacoStudioError("Nao foi possivel confirmar a protecao de espaco. Aplique a migracao de cota do Studio antes de preparar novas musicas.", 503);
  let usados: number;
  try { usados = await medirEspacoR2(); }
  catch { throw new EspacoStudioError("Nao foi possivel medir o espaco do R2. Os ensaios prontos continuam disponiveis; tente preparar novamente mais tarde.", 503); }
  const { data, error } = await db.rpc("reservar_espaco_louvor_studio", {
    p_id: id, p_bytes: bytes, p_usados: usados, p_inicio: inicio,
  });
  if (error || !data) throw new EspacoStudioError("Nao foi possivel reservar espaco com seguranca. Tente novamente mais tarde.", 503);
  if (!data.permitido) {
    const disponivel = Math.max(0, Number(data.disponivel ?? 0)) / 1e9;
    throw new EspacoStudioError(`Limite seguro de 8 GB do Studio: ${disponivel.toFixed(2)} GB livres, considerando preparacoes em andamento. Aguarde a limpeza apos os cultos ou a conclusao das preparacoes. Os ensaios prontos continuam funcionando.`, 409);
  }
}

export async function finalizarReservaStudio(id: string): Promise<void> {
  const { error } = await db.rpc("finalizar_reserva_louvor_studio", { p_id: id });
  if (error) console.error("Nao foi possivel finalizar a reserva de espaco do Studio:", error.code);
}
