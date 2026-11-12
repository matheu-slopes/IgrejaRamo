-- O nome da função passa a aceitar opções configuradas por ministério.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.escala_itens'::regclass AND attname = 'funcao' AND atttypid <> 'text'::regtype) THEN
    ALTER TABLE public.escala_itens ALTER COLUMN funcao TYPE text USING funcao::text;
    -- Preserva os nomes que o aplicativo mostrava para os valores antigos do enum.
    UPDATE public.escala_itens SET funcao = CASE funcao
      WHEN 'Bateria' THEN 'Cajón'
      WHEN 'Professora' THEN 'Professor(a)'
      WHEN 'Monitor' THEN 'Monitor(a)'
      WHEN 'Voluntário' THEN 'Voluntário(a)'
      WHEN 'Projeção/Letras' THEN 'Projeção'
      WHEN 'Fotografia' THEN 'Videomaker'
      ELSE funcao END
    WHERE funcao IN ('Bateria','Professora','Monitor','Voluntário','Projeção/Letras','Fotografia');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.funcoes_ministerio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio text NOT NULL,
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 80),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ministerio, nome)
);
ALTER TABLE public.funcoes_ministerio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funcoes_ministerio FROM anon, authenticated;
GRANT ALL ON public.funcoes_ministerio TO service_role;

INSERT INTO public.funcoes_ministerio (ministerio, nome)
SELECT ministerio, nome FROM (VALUES
  ('Louvor','Ministro'),('Louvor','Backing Vocal'),('Louvor','Guitarra'),('Louvor','Violão'),('Louvor','Baixo'),('Louvor','Teclado'),('Louvor','Cajón'),
  ('Mídias','Projeção'),('Mídias','Transmissão'),('Mídias','Videomaker'),
  ('Recepcionamento','Abertura'),('Recepcionamento','Oferta'),('Recepcionamento','Recepção'),
  ('Limpeza','Escala de Limpeza'),('Infantil','Professor(a)'),('Infantil','Auxiliar'),
  ('Ação Social','Líder'),('Ação Social','Voluntário(a)'),
  ('Jovens','Discipulador(a)'),('Jovens','Recepção'),('Jovens','Abertura'),('Jovens','Oferta'),('Jovens','Pregador(a)'),
  ('Ensino','Preletor(a)'),('Oração','Responsável')
) AS defaults(ministerio,nome)
ON CONFLICT (ministerio,nome) DO NOTHING;

-- Ministérios existentes fora da lista padrão e ministérios criados depois da
-- migração começam com uma função editável, sem depender de mudanças no código.
INSERT INTO public.funcoes_ministerio (ministerio, nome)
SELECT c.ministerio, 'Responsável' FROM public.canais_ministerio c
WHERE NOT EXISTS (SELECT 1 FROM public.funcoes_ministerio f WHERE f.ministerio = c.ministerio)
ON CONFLICT (ministerio,nome) DO NOTHING;

CREATE OR REPLACE FUNCTION public.criar_funcao_inicial_ministerio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.funcoes_ministerio (ministerio, nome) VALUES (NEW.ministerio, 'Responsável')
  ON CONFLICT (ministerio,nome) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS criar_funcao_inicial ON public.canais_ministerio;
CREATE TRIGGER criar_funcao_inicial AFTER INSERT ON public.canais_ministerio
FOR EACH ROW EXECUTE FUNCTION public.criar_funcao_inicial_ministerio();

-- A remoção pelo cadastro do usuário também remove o vínculo detalhado.
CREATE OR REPLACE FUNCTION public.sincronizar_membros_ao_remover_ministerio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.membros_ministerio mm WHERE mm.usuario_id = NEW.id
    AND mm.ministerio = ANY(COALESCE(OLD.ministerios, ARRAY[]::text[]))
    AND NOT (mm.ministerio = ANY(COALESCE(NEW.ministerios, ARRAY[]::text[])));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sincronizar_membros_ao_remover ON public.perfis;
CREATE TRIGGER sincronizar_membros_ao_remover AFTER UPDATE OF ministerios ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_membros_ao_remover_ministerio();

-- Renomear atualiza as equipes; escalas registradas preservam o histórico.
CREATE OR REPLACE FUNCTION public.renomear_funcao_nas_equipes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.equipes_ministerio e SET membros = (
      SELECT COALESCE(jsonb_agg(CASE WHEN m->>'funcao' = OLD.nome THEN jsonb_set(m, '{funcao}', to_jsonb(NEW.nome)) ELSE m END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(e.membros) WITH ORDINALITY AS itens(m, ord)
    ) WHERE e.ministerio = OLD.ministerio AND e.membros @> jsonb_build_array(jsonb_build_object('funcao', OLD.nome));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS renomear_funcao_equipes ON public.funcoes_ministerio;
CREATE TRIGGER renomear_funcao_equipes AFTER UPDATE OF nome ON public.funcoes_ministerio
FOR EACH ROW EXECUTE FUNCTION public.renomear_funcao_nas_equipes();

-- Atualiza somente o integrante escolhido, sem sobrescrever outras edições.
CREATE OR REPLACE FUNCTION public.alterar_funcao_integrante_equipe(p_equipe uuid, p_usuario uuid, p_funcao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE equipe public.equipes_ministerio%ROWTYPE;
BEGIN
  SELECT * INTO equipe FROM public.equipes_ministerio WHERE id = p_equipe FOR UPDATE;
  IF NOT FOUND OR NOT equipe.membros @> jsonb_build_array(jsonb_build_object('usuarioId', p_usuario::text)) THEN
    RAISE EXCEPTION 'Integrante não encontrado na equipe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = p_usuario AND p.ativo AND equipe.ministerio = ANY(p.ministerios)) THEN
    RAISE EXCEPTION 'Integrante não pertence ao ministério';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funcoes_ministerio f WHERE f.ministerio = equipe.ministerio AND f.nome = p_funcao AND f.ativo) THEN
    RAISE EXCEPTION 'Função indisponível no ministério';
  END IF;
  UPDATE public.equipes_ministerio SET membros = (
    SELECT jsonb_agg(CASE WHEN m->>'usuarioId' = p_usuario::text THEN jsonb_set(m, '{funcao}', to_jsonb(p_funcao)) ELSE m END ORDER BY ord)
    FROM jsonb_array_elements(equipe.membros) WITH ORDINALITY AS itens(m, ord)
  ) WHERE id = p_equipe;
END $$;
REVOKE ALL ON FUNCTION public.alterar_funcao_integrante_equipe(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_funcao_integrante_equipe(uuid, uuid, text) TO service_role;
