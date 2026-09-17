-- Louvor Studio: acesso privado, fila de processamento e arquivos protegidos.

ALTER TYPE public.funcao_ministerio ADD VALUE IF NOT EXISTS 'Ministro';

CREATE TABLE IF NOT EXISTS public.louvor_studio_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Processando música',
  artista TEXT,
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'baixando', 'analisando', 'separando', 'concluido', 'erro')),
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  tom_original TEXT,
  bpm NUMERIC(7,2),
  duracao_segundos NUMERIC(10,2),
  audio_path TEXT,
  stems JSONB NOT NULL DEFAULT '{}'::jsonb,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_louvor_studio_projetos_criado_em
  ON public.louvor_studio_projetos (criado_em DESC);

CREATE OR REPLACE FUNCTION public.pode_usar_louvor_studio(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = p_user_id
        AND p.ativo = TRUE
        AND (
          p.role::text IN ('admin', 'pastor')
          OR COALESCE(p.lider_ministerios, ARRAY[]::text[]) @> ARRAY['Louvor']::text[]
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.membros_ministerio mm
      WHERE mm.usuario_id = p_user_id
        AND mm.ministerio::text = 'Louvor'
        AND mm.funcao::text IN ('Ministro', 'Líder', 'Colíder')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.pode_usar_louvor_studio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_usar_louvor_studio(UUID) TO authenticated;

ALTER TABLE public.louvor_studio_projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS louvor_studio_select_autorizado ON public.louvor_studio_projetos;
CREATE POLICY louvor_studio_select_autorizado ON public.louvor_studio_projetos
  FOR SELECT TO authenticated
  USING (public.pode_usar_louvor_studio());

-- Inserções e atualizações são feitas somente pelas APIs e pelo worker com service role.
REVOKE INSERT, UPDATE, DELETE ON public.louvor_studio_projetos FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'louvor-studio',
  'louvor-studio',
  FALSE,
  104857600,
  ARRAY['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS louvor_studio_storage_select ON storage.objects;
CREATE POLICY louvor_studio_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'louvor-studio' AND public.pode_usar_louvor_studio());

