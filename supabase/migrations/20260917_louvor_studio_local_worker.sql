-- Louvor Studio local: fila segura, vínculo com escala e acesso aos participantes.

ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS escala_id UUID REFERENCES public.escalas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tom_alvo TEXT,
  ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processando_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS acordes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_louvor_studio_fila
  ON public.louvor_studio_projetos (status, criado_em);
CREATE INDEX IF NOT EXISTS idx_louvor_studio_escala
  ON public.louvor_studio_projetos (escala_id);
CREATE INDEX IF NOT EXISTS idx_louvor_studio_expira
  ON public.louvor_studio_projetos (expira_em);

CREATE OR REPLACE FUNCTION public.pode_ver_louvor_studio(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.id = p_user_id
      AND p.ativo = TRUE
      AND (
        p.role::text IN ('admin', 'pastor')
        OR COALESCE(p.ministerios, ARRAY[]::text[]) @> ARRAY['Louvor']::text[]
        OR COALESCE(p.lider_ministerios, ARRAY[]::text[]) @> ARRAY['Louvor']::text[]
        OR EXISTS (
          SELECT 1 FROM public.membros_ministerio mm
          WHERE mm.usuario_id = p_user_id AND mm.ministerio::text = 'Louvor'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_louvor_studio(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.id = p_user_id
      AND p.ativo = TRUE
      AND (
        p.role::text IN ('admin', 'pastor')
        OR COALESCE(p.lider_ministerios, ARRAY[]::text[]) @> ARRAY['Louvor']::text[]
        OR EXISTS (
          SELECT 1 FROM public.membros_ministerio mm
          WHERE mm.usuario_id = p_user_id
            AND mm.ministerio::text = 'Louvor'
            AND mm.funcao::text IN ('Ministro', 'Líder', 'Colíder')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pode_ver_louvor_studio(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_gerenciar_louvor_studio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_louvor_studio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_louvor_studio(UUID) TO authenticated;

DROP POLICY IF EXISTS louvor_studio_select_autorizado ON public.louvor_studio_projetos;
DROP POLICY IF EXISTS louvor_studio_select_participante ON public.louvor_studio_projetos;
CREATE POLICY louvor_studio_select_participante ON public.louvor_studio_projetos
  FOR SELECT TO authenticated
  USING (public.pode_ver_louvor_studio());

DROP POLICY IF EXISTS louvor_studio_storage_select ON storage.objects;
CREATE POLICY louvor_studio_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'louvor-studio' AND public.pode_ver_louvor_studio());

UPDATE public.louvor_studio_projetos
SET expira_em = COALESCE(expira_em, NOW() + INTERVAL '7 days')
WHERE expira_em IS NULL;
