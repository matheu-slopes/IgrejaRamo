// Mantém fotos somente na memória da aba, por pouco tempo e por usuário.
const DURACAO_MS = 60_000;
let cache: { usuarioId: string; fotos: Record<string, string>; expiraEm: number } | null = null;

export function obterFotosEmCache(usuarioId: string): Record<string, string> | null {
  return cache?.usuarioId === usuarioId && cache.expiraEm > Date.now() ? cache.fotos : null;
}

export function guardarFotosEmCache(usuarioId: string, fotos: Record<string, string>): void {
  cache = { usuarioId, fotos, expiraEm: Date.now() + DURACAO_MS };
}

export function limparCacheDeFotos(): void {
  cache = null;
}
