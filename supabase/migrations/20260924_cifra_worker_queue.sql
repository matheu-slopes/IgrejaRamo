-- Fila pequena e temporaria para buscar cifras pelo worker residencial.
-- A cifra permanente continua em musicas; esta tabela e limpa automaticamente.
ALTER TABLE public.musicas
  ADD COLUMN IF NOT EXISTS forma_da_cifra text,
  ADD COLUMN IF NOT EXISTS capotraste text;

CREATE TABLE IF NOT EXISTS public.cifra_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artista_slug text NOT NULL CHECK (artista_slug ~ '^[a-z0-9-]+$'),
  musica_slug text NOT NULL CHECK (musica_slug ~ '^[a-z0-9-]+$'),
  versao text NOT NULL DEFAULT 'principal' CHECK (versao IN ('principal', 'simplificada')),
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'processando', 'concluido', 'erro')),
  resultado jsonb,
  erro text,
  worker_id text,
  claim_token uuid,
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 3),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '1 day')
);

CREATE INDEX IF NOT EXISTS cifra_jobs_fila_idx ON public.cifra_jobs (status, criado_em)
  WHERE status IN ('aguardando', 'processando');
CREATE INDEX IF NOT EXISTS cifra_jobs_usuario_fonte_idx
  ON public.cifra_jobs (user_id, artista_slug, musica_slug, versao, criado_em DESC);

ALTER TABLE public.cifra_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cifra_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.cifra_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.claim_cifra_job(p_worker text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_job public.cifra_jobs;
  v_token uuid;
BEGIN
  DELETE FROM public.cifra_jobs
  WHERE expira_em < now()
     OR (status IN ('concluido', 'erro') AND atualizado_em < now() - interval '1 day');

  UPDATE public.cifra_jobs
  SET status = CASE WHEN tentativas >= 3 THEN 'erro' ELSE 'aguardando' END,
      erro = CASE WHEN tentativas >= 3 THEN 'O processador local nao respondeu.' ELSE erro END,
      worker_id = NULL, claim_token = NULL, atualizado_em = now()
  WHERE status = 'processando' AND atualizado_em < now() - interval '2 minutes';

  SELECT job.* INTO v_job FROM public.cifra_jobs AS job
  WHERE job.status = 'aguardando' AND job.tentativas < 3 AND job.expira_em > now()
  ORDER BY job.criado_em FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_token := gen_random_uuid();
  UPDATE public.cifra_jobs AS job
  SET status = 'processando', worker_id = left(p_worker, 100), claim_token = v_token,
      tentativas = job.tentativas + 1, atualizado_em = now(), erro = NULL
  WHERE job.id = v_job.id RETURNING job.* INTO v_job;

  RETURN jsonb_build_object('id', v_job.id, 'artista_slug', v_job.artista_slug,
    'musica_slug', v_job.musica_slug, 'versao', v_job.versao, 'claim_token', v_job.claim_token);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cifra_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cifra_job(text) TO service_role;
