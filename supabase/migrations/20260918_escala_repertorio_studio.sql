-- Repertório é o catálogo permanente; a escala guarda somente as decisões
-- daquele culto. Um projeto do Studio pode apontar para ambos para que a
-- análise de tom/BPM volte ao set correto.

ALTER TABLE public.escala_musicas
  ADD COLUMN IF NOT EXISTS bpm NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS artista_slug TEXT,
  ADD COLUMN IF NOT EXISTS musica_slug TEXT;

ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS musica_id UUID REFERENCES public.musicas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_louvor_studio_projetos_musica
  ON public.louvor_studio_projetos (musica_id);
