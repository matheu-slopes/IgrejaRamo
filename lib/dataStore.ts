/**
 * dataStore.ts — Cache global em memória para carregamento instantâneo
 *
 * Funciona como um mini-store reativo:
 * - Serve dados do cache IMEDIATAMENTE ao montar qualquer componente
 * - Atualiza em background sem travar a UI
 * - Persiste snapshot no sessionStorage para sobreviver a navegações rápidas
 * - Subscribers são notificados quando os dados mudam (Realtime / polling)
 */

type Subscriber<T> = (data: T) => void;

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

class DataStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache = new Map<string, CacheEntry<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private subscribers = new Map<string, Set<Subscriber<any>>>();

  constructor() {
    // Hidrata do sessionStorage na inicialização (sobrevive a navegações)
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("ramo_store_v1");
        if (raw) {
          const snapshot = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
          for (const [key, entry] of Object.entries(snapshot)) {
            // Ignora entradas muito antigas (> 5 minutos)
            if (Date.now() - entry.updatedAt < 5 * 60 * 1000) {
              this.cache.set(key, entry);
            }
          }
        }
      } catch {
        // sessionStorage indisponível ou corrompido — ignora
      }
    }
  }

  /** Retorna dados do cache (ou undefined se não houver) */
  get<T>(key: string): T | undefined {
    return this.cache.get(key)?.data as T | undefined;
  }

  /** Retorna true se há dados cached (mesmo que antigos) */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Retorna quantos ms atrás os dados foram atualizados */
  age(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return Infinity;
    return Date.now() - entry.updatedAt;
  }

  /** Salva dados no cache e notifica todos os subscribers desta chave */
  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, updatedAt: Date.now() });
    this.persist();
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((fn) => {
        try { fn(data); } catch { /* subscriber não deve quebrar o store */ }
      });
    }
  }

  /** Invalida (remove) uma entrada do cache para forçar refetch */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.persist();
  }

  /**
   * Registra um subscriber para uma chave.
   * Retorna função de cleanup (para usar no useEffect return).
   */
  subscribe<T>(key: string, callback: Subscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback as Subscriber<unknown>);
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback as Subscriber<unknown>);
        if (subs.size === 0) this.subscribers.delete(key);
      }
    };
  }

  /** Persiste snapshot no sessionStorage */
  private persist() {
    if (typeof window === "undefined") return;
    try {
      const snapshot: Record<string, CacheEntry<unknown>> = {};
      for (const [key, entry] of this.cache.entries()) {
        snapshot[key] = entry;
      }
      sessionStorage.setItem("ramo_store_v1", JSON.stringify(snapshot));
    } catch {
      // Quota excedida ou modo privativo — ignora
    }
  }
}

// Singleton — compartilhado por todo o app
export const store = new DataStore();

// ── Chaves padronizadas para evitar typos ───────────────────────────────────
export const STORE_KEYS = {
  /** Aviso fixado no topo do Dashboard */
  AVISO_FIXADO: "aviso_fixado",
  /** Lista de avisos filtrados para o usuário */
  AVISOS: (uid: string) => `avisos:${uid}`,
  /** Próximos eventos */
  EVENTOS: "eventos:proximos",
  /** Todos os eventos (página de Eventos) */
  EVENTOS_TODOS: "eventos:todos",
  /** Escala do usuário no Dashboard (próxima) */
  MINHA_ESCALA: (uid: string) => `minha_escala:${uid}`,
  /** Todas as escalas (página de Escalas) */
  ESCALAS_TODAS: "escalas:todas",
  /** Perfis de usuários (admin) */
  PERFIS: "perfis:todos",
  /** Locais */
  LOCAIS: "locais:todos",
  /** Ministérios */
  MINISTERIOS: "ministerios:todos",
} as const;
