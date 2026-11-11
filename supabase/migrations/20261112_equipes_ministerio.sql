-- Equipes reutilizáveis para as escalas de cada ministério.
CREATE TABLE IF NOT EXISTS public.equipes_ministerio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio text NOT NULL,
  nome text NOT NULL,
  membros jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ministerio, nome)
);
ALTER TABLE public.equipes_ministerio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipes_ministerio FROM anon, authenticated;
GRANT ALL ON public.equipes_ministerio TO service_role;

-- Importa apenas pessoas ativas que ainda pertencem ao Louvor.
INSERT INTO public.equipes_ministerio (ministerio, nome, membros)
SELECT 'Louvor', e.nome, COALESCE((
  SELECT jsonb_agg(jsonb_build_object('usuarioId', p.id, 'funcao', m.funcao) ORDER BY m.ordem)
  FROM jsonb_to_recordset(e.membros) AS m(id uuid, funcao text, ordem int)
  JOIN public.perfis p ON p.id = m.id
  WHERE p.ativo = true AND 'Louvor' = ANY(p.ministerios)
), '[]'::jsonb)
FROM (VALUES
 ('Equipe 1', '[{"id":"093a4e47-e3b6-4ffe-9ac0-efcdf0800bf9","funcao":"Ministro","ordem":1},{"id":"2a5a89e6-0452-4643-af64-c17f7881e7e5","funcao":"Backing Vocal","ordem":2},{"id":"8ecd6e4e-67c0-437d-9e36-8edb80d5276c","funcao":"Backing Vocal","ordem":3},{"id":"af737764-2a81-4f89-8153-672571c5df16","funcao":"Cajón","ordem":4}]'::jsonb),
 ('Equipe 2', '[{"id":"4c646c5d-cf1a-401f-a8bf-5bc9af996cdf","funcao":"Ministro","ordem":1},{"id":"4d729cce-d0a0-42b1-9d09-62d3cd4b7b87","funcao":"Backing Vocal","ordem":2},{"id":"d935d257-c430-44fe-9577-2e15a2ab94fa","funcao":"Cajón","ordem":3},{"id":"ad69a900-1be0-41fa-943b-20c30a5bfb3c","funcao":"Backing Vocal","ordem":4}]'::jsonb),
 ('Equipe 3', '[{"id":"253ebd74-151a-405b-ba2a-87e64107ab59","funcao":"Ministro","ordem":1},{"id":"01c938ee-69b0-430b-9fe3-cd6632d70982","funcao":"Backing Vocal","ordem":2},{"id":"d153862e-bdc6-4769-8bbd-4814b10b3846","funcao":"Backing Vocal","ordem":3},{"id":"c9db7bdf-0d50-4698-8728-d45b91e09c63","funcao":"Cajón","ordem":4}]'::jsonb)
) AS e(nome, membros)
ON CONFLICT (ministerio, nome) DO NOTHING;

-- Desvincula automaticamente ao remover, desativar ou excluir o perfil.
CREATE OR REPLACE FUNCTION public.limpar_equipes_do_perfil() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.equipes_ministerio e
  SET membros = COALESCE((SELECT jsonb_agg(m) FROM jsonb_array_elements(e.membros) m WHERE m->>'usuarioId' <> OLD.id::text), '[]'::jsonb)
  WHERE e.membros @> jsonb_build_array(jsonb_build_object('usuarioId', OLD.id::text))
    AND (TG_OP = 'DELETE' OR NOT COALESCE(NEW.ativo, false) OR NOT (e.ministerio = ANY(COALESCE(NEW.ministerios, ARRAY[]::text[]))));
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS limpar_equipes_apos_perfil ON public.perfis;
CREATE TRIGGER limpar_equipes_apos_perfil AFTER UPDATE OF ministerios, ativo OR DELETE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.limpar_equipes_do_perfil();
