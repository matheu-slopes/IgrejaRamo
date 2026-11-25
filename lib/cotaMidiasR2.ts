import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { medirMidiasPrivadas } from "@/lib/armazenamentoMidiasR2";

export const MAX_ARQUIVO_MIDIA_BYTES = 4 * 1024 * 1024;

export class CotaMidiasError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Impede uploads se não for possível medir e reservar espaço com segurança. */
export async function reservarMidia(admin: SupabaseClient, id: string, bytes: number): Promise<void> {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_ARQUIVO_MIDIA_BYTES) throw new CotaMidiasError("O arquivo deve ter no máximo 4 MB.", 413);
  const { data: inicio, error: inicioError } = await admin.rpc("midias_r2_inicio_medicao");
  if (inicioError || typeof inicio !== "string") throw new CotaMidiasError("Não foi possível verificar o espaço das mídias.", 503);
  let usados: number;
  try { usados = await medirMidiasPrivadas(); }
  catch { throw new CotaMidiasError("Não foi possível verificar o espaço das mídias.", 503); }
  const { data, error } = await admin.rpc("reservar_espaco_midias_r2", { p_id: id, p_bytes: bytes, p_usados: usados, p_inicio: inicio });
  if (error || !data || typeof data.permitido !== "boolean") throw new CotaMidiasError("Não foi possível reservar espaço para a mídia.", 503);
  if (!data.permitido) throw new CotaMidiasError("O limite de espaço para mídias foi atingido. Avise a administração.", 409);
}

export async function finalizarReservaMidia(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.rpc("finalizar_reserva_midias_r2", { p_id: id });
  if (error) console.error("Não foi possível finalizar a reserva de mídia:", error.code);
}
