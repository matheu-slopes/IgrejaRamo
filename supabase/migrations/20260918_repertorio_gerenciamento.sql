-- Catálogo permanente do Louvor: arquivar preserva as escalas passadas e
-- impede que a música volte a ser oferecida para novos sets.
ALTER TABLE public.musicas
  ADD COLUMN IF NOT EXISTS arquivada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_musicas_arquivada_titulo
  ON public.musicas (arquivada, titulo);

-- Apenas admin, pastor ou quem lidera o Louvor pode alterar o catálogo.
-- Integrantes autenticados continuam podendo consultá-lo para estudar.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_repertorio_louvor(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = p_user
        AND p.ativo = TRUE
        AND (
          p.role::text IN ('admin', 'pastor')
          OR COALESCE(p.lider_ministerios, ARRAY[]::text[]) @> ARRAY['Louvor']::text[]
          OR COALESCE(p.permissoes, ARRAY[]::text[]) @> ARRAY['gerenciar_repertorio']::text[]
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.membros_ministerio mm
      WHERE mm.usuario_id = p_user
        AND mm.ministerio::text = 'Louvor'
        AND mm.funcao::text = 'Líder'
    )
  );
$$;

ALTER TABLE public.musicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "musicas_select" ON public.musicas;
DROP POLICY IF EXISTS "musicas_insert" ON public.musicas;
DROP POLICY IF EXISTS "musicas_update" ON public.musicas;
DROP POLICY IF EXISTS "musicas_delete" ON public.musicas;

CREATE POLICY "musicas_select" ON public.musicas
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "musicas_insert_louvor" ON public.musicas
  FOR INSERT WITH CHECK (public.pode_gerenciar_repertorio_louvor(auth.uid()));
CREATE POLICY "musicas_update_louvor" ON public.musicas
  FOR UPDATE USING (public.pode_gerenciar_repertorio_louvor(auth.uid()))
  WITH CHECK (public.pode_gerenciar_repertorio_louvor(auth.uid()));
CREATE POLICY "musicas_delete_louvor" ON public.musicas
  FOR DELETE USING (public.pode_gerenciar_repertorio_louvor(auth.uid()));

REVOKE ALL ON FUNCTION public.pode_gerenciar_repertorio_louvor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_repertorio_louvor(UUID) TO authenticated, service_role;
