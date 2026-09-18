-- Additive migration: existing projects and MP3s remain playable.
ALTER TABLE public.louvor_studio_projetos
 ADD COLUMN IF NOT EXISTS separation_mode text NOT NULL DEFAULT 'legacy'
   CHECK (separation_mode IN ('legacy','bs_roformer','htdemucs_ft')),
 ADD COLUMN IF NOT EXISTS lossless_stems jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS pipeline_version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS audio_hash text,
 ADD COLUMN IF NOT EXISTS model_version text,
 ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.louvor_studio_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 projeto_id uuid NOT NULL REFERENCES public.louvor_studio_projetos(id) ON DELETE CASCADE,
 semitones integer NOT NULL CHECK (semitones BETWEEN -11 AND 11),
 speed numeric NOT NULL DEFAULT 1 CHECK (speed IN (0.75,0.9,1,1.1)),
 engine text NOT NULL DEFAULT 'r3-stereo-v1',
 status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','processando','concluido','erro')),
 progresso integer NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
 stems jsonb NOT NULL DEFAULT '{}'::jsonb,
 mix_wav text, mix_mp3 text,
 erro text, worker_id text, claim_token uuid,
 criado_por uuid REFERENCES auth.users(id),
 tentativas integer NOT NULL DEFAULT 0,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(projeto_id,semitones,speed,engine)
);
ALTER TABLE public.louvor_studio_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.louvor_studio_versions FROM anon, authenticated;
GRANT ALL ON public.louvor_studio_versions TO service_role;
CREATE INDEX IF NOT EXISTS louvor_studio_versions_queue ON public.louvor_studio_versions(status,criado_em);
ALTER TABLE public.louvor_studio_projetos ADD COLUMN IF NOT EXISTS claim_token uuid;
-- WAV stereo float32 for a 20 minute recording requires ~424 MB.
UPDATE storage.buckets SET file_size_limit=536870912,
 allowed_mime_types=ARRAY['audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/ogg']
 WHERE id='louvor-studio';

-- Atomic claims prevent two processors from handling the same work.
CREATE OR REPLACE FUNCTION public.claim_louvor_hq(p_worker text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.louvor_studio_versions; p public.louvor_studio_projetos; token uuid;
BEGIN
 -- Exhausted leases become visible failures, not infinite retries.
 UPDATE louvor_studio_versions SET status='erro',erro='Processador desconectado. Tente novamente.',claim_token=NULL
 WHERE status='processando' AND atualizado_em < now()-interval '5 minutes';
 UPDATE louvor_studio_projetos SET status='erro',erro='Processador desconectado. Prepare novamente.',claim_token=NULL
 WHERE pipeline_version=2 AND status IN ('baixando','analisando','separando')
 AND atualizado_em < now()-interval '5 minutes';

 SELECT * INTO v FROM louvor_studio_versions
 WHERE status='aguardando' AND tentativas < 3
 AND EXISTS(SELECT 1 FROM louvor_studio_projetos owner_project WHERE owner_project.id=projeto_id AND owner_project.expira_em>now())
 ORDER BY criado_em FOR UPDATE SKIP LOCKED LIMIT 1;
 IF FOUND THEN
  token=gen_random_uuid();
  UPDATE louvor_studio_versions SET status='processando',worker_id=p_worker,claim_token=token,
   progresso=1,tentativas=tentativas+1,atualizado_em=now() WHERE id=v.id RETURNING * INTO v;
  SELECT * INTO p FROM louvor_studio_projetos WHERE id=v.projeto_id;
  RETURN jsonb_build_object('kind','pitch','version',to_jsonb(v),'project',to_jsonb(p));
 END IF;
 SELECT * INTO p FROM louvor_studio_projetos WHERE pipeline_version=2 AND status='aguardando'
 AND tentativas<3 AND expira_em>now() ORDER BY criado_em FOR UPDATE SKIP LOCKED LIMIT 1;
 IF FOUND THEN
  token=gen_random_uuid();
  UPDATE louvor_studio_projetos SET status='baixando',worker_id=p_worker,claim_token=token,
   progresso=2,tentativas=tentativas+1,atualizado_em=now(),processando_em=now()
   WHERE id=p.id RETURNING * INTO p;
  RETURN jsonb_build_object('kind','separate','project',to_jsonb(p));
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_louvor_hq(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_louvor_hq(text) TO service_role;

