-- A mesma base separada pode atender mais de uma escala. A escala guarda
-- somente a decisão do culto (tom e BPM), sem duplicar as faixas no storage.
ALTER TABLE public.escala_musicas
  ADD COLUMN IF NOT EXISTS studio_projeto_id UUID
    REFERENCES public.louvor_studio_projetos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_escala_musicas_studio_projeto
  ON public.escala_musicas(studio_projeto_id);

-- Mantém os projetos já preparados ligados às escalas que os criaram.
UPDATE public.escala_musicas AS em
SET studio_projeto_id = projeto.id
FROM public.louvor_studio_projetos AS projeto
WHERE em.studio_projeto_id IS NULL
  AND em.escala_id = projeto.escala_id
  AND em.musica_id = projeto.musica_id;
