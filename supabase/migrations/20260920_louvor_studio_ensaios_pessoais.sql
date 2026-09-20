-- A biblioteca da equipe e os ensaios pessoais têm prazos diferentes.
-- Áudios pessoais ficam privados e são removidos após sete dias.
ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS visibilidade TEXT NOT NULL DEFAULT 'equipe'
    CHECK (visibilidade IN ('equipe', 'pessoal')),
  ADD COLUMN IF NOT EXISTS ultimo_uso_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_louvor_studio_projetos_pessoais
  ON public.louvor_studio_projetos (criado_por, visibilidade, status, criado_em DESC);

-- Projetos já existentes pertencem à biblioteca da equipe. Dá tempo para a
-- nova política de retenção antes da primeira limpeza automática.
UPDATE public.louvor_studio_projetos
SET visibilidade = COALESCE(visibilidade, 'equipe'),
    ultimo_uso_em = COALESCE(ultimo_uso_em, criado_em),
    expira_em = CASE
      WHEN status = 'concluido' THEN GREATEST(COALESCE(expira_em, NOW()), NOW() + INTERVAL '90 days')
      ELSE expira_em
    END
WHERE visibilidade = 'equipe';
