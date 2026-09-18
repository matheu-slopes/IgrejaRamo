-- Corrige a função de reserva atômica do worker HQ. A primeira versão usava
-- `p` tanto como registro PL/pgSQL quanto em referências SQL, o que fazia o
-- PostgreSQL recusar a reserva com "column reference p.id is ambiguous".
CREATE OR REPLACE FUNCTION public.claim_louvor_hq(p_worker text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.louvor_studio_versions;
  v_project public.louvor_studio_projetos;
  v_token uuid;
BEGIN
  UPDATE public.louvor_studio_versions AS version_row
  SET status = 'erro', erro = 'Processador desconectado. Tente novamente.', claim_token = NULL
  WHERE version_row.status = 'processando'
    AND version_row.atualizado_em < now() - interval '5 minutes';

  UPDATE public.louvor_studio_projetos AS project_row
  SET status = 'erro', erro = 'Processador desconectado. Prepare novamente.', claim_token = NULL
  WHERE project_row.pipeline_version = 2
    AND project_row.status IN ('baixando', 'analisando', 'separando')
    AND project_row.atualizado_em < now() - interval '5 minutes';

  SELECT version_row.*
  INTO v_version
  FROM public.louvor_studio_versions AS version_row
  WHERE version_row.status = 'aguardando'
    AND version_row.tentativas < 3
    AND EXISTS (
      SELECT 1
      FROM public.louvor_studio_projetos AS owner_project
      WHERE owner_project.id = version_row.projeto_id
        AND owner_project.expira_em > now()
    )
  ORDER BY version_row.criado_em
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF FOUND THEN
    v_token := gen_random_uuid();
    UPDATE public.louvor_studio_versions AS version_row
    SET status = 'processando', worker_id = p_worker, claim_token = v_token,
        progresso = 1, tentativas = version_row.tentativas + 1, atualizado_em = now()
    WHERE version_row.id = v_version.id
    RETURNING version_row.* INTO v_version;

    SELECT project_row.*
    INTO v_project
    FROM public.louvor_studio_projetos AS project_row
    WHERE project_row.id = v_version.projeto_id;

    RETURN jsonb_build_object('kind', 'pitch', 'version', to_jsonb(v_version), 'project', to_jsonb(v_project));
  END IF;

  SELECT project_row.*
  INTO v_project
  FROM public.louvor_studio_projetos AS project_row
  WHERE project_row.pipeline_version = 2
    AND project_row.status = 'aguardando'
    AND project_row.tentativas < 3
    AND project_row.expira_em > now()
  ORDER BY project_row.criado_em
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF FOUND THEN
    v_token := gen_random_uuid();
    UPDATE public.louvor_studio_projetos AS project_row
    SET status = 'baixando', worker_id = p_worker, claim_token = v_token,
        progresso = 2, tentativas = project_row.tentativas + 1,
        atualizado_em = now(), processando_em = now()
    WHERE project_row.id = v_project.id
    RETURNING project_row.* INTO v_project;

    RETURN jsonb_build_object('kind', 'separate', 'project', to_jsonb(v_project));
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_louvor_hq(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_louvor_hq(text) TO service_role;
