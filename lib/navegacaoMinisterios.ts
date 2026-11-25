import { sameMinisterio } from "@/lib/userMinistries";

export const ministeriosPadrao = ["Ação Social", "Ensino", "Infantil", "Jovens", "Limpeza", "Louvor", "Mídias", "Oração", "Recepcionamento"];

/** Usa os canais cadastrados como fonte e respeita os vínculos de cada membro. */
export function ministeriosNoMenu(cadastrados: string[] | null, associados: string[], isAdmin: boolean): string[] {
  const disponiveis = cadastrados ?? (isAdmin ? ministeriosPadrao : associados);
  return disponiveis
    .filter((nome) => isAdmin || associados.some((item) => sameMinisterio(item, nome)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function caminhoMinisterio(nome: string): string {
  return `/dashboard/ministerio/${encodeURIComponent(nome)}`;
}
