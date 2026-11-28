-- Mantém o último contato do computador que processa os áudios, inclusive
-- enquanto não há músicas na fila.
CREATE TABLE IF NOT EXISTS public.louvor_studio_workers (
  worker_id TEXT PRIMARY KEY CHECK (char_length(worker_id) BETWEEN 1 AND 100),
  nome TEXT,
  visto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.louvor_studio_workers
  ADD COLUMN IF NOT EXISTS nome TEXT;
UPDATE public.louvor_studio_workers SET nome = worker_id WHERE nome IS NULL;
ALTER TABLE public.louvor_studio_workers
  ALTER COLUMN nome SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_louvor_studio_workers_visto_em
  ON public.louvor_studio_workers (visto_em DESC);

ALTER TABLE public.louvor_studio_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.louvor_studio_workers FROM anon, authenticated;
GRANT ALL ON public.louvor_studio_workers TO service_role;
