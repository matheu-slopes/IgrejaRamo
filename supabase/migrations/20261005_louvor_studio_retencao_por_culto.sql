-- The repertoire and service decisions are permanent; Studio audio is temporary.
-- An original service must not cascade-delete audio used by another service.
ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS limpeza_em TIMESTAMPTZ;
ALTER TABLE public.louvor_studio_projetos
  DROP CONSTRAINT IF EXISTS louvor_studio_projetos_escala_id_fkey;
ALTER TABLE public.louvor_studio_projetos
  ADD CONSTRAINT louvor_studio_projetos_escala_id_fkey
  FOREIGN KEY (escala_id) REFERENCES public.escalas(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.louvor_studio_expiracao_cultos(p_projeto UUID, p_escala UUID)
RETURNS TIMESTAMPTZ LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT (MAX(data) + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
  FROM (
    SELECT e.data FROM public.escalas e WHERE e.id = p_escala
    UNION ALL
    SELECT e.data FROM public.escala_musicas em
    JOIN public.escalas e ON e.id = em.escala_id
    WHERE em.studio_projeto_id = p_projeto
  ) AS cultos;
$$;

CREATE OR REPLACE FUNCTION public.louvor_studio_fixar_expiracao_culto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE expiracao TIMESTAMPTZ;
BEGIN
  expiracao := public.louvor_studio_expiracao_cultos(NEW.id, NEW.escala_id);
  IF expiracao IS NOT NULL THEN NEW.expira_em := expiracao; END IF;
  -- Once deletion starts, files may already be partially removed. Reject a
  -- concurrent future link/reschedule rather than preserve a row with no audio.
  IF TG_OP = 'UPDATE' AND OLD.limpeza_em IS NOT NULL AND
    (NEW.expira_em > clock_timestamp() OR NEW.status NOT IN ('concluido', 'erro', 'aguardando')) THEN
    RAISE EXCEPTION 'Esta preparacao esta sendo removida; prepare o audio novamente para o novo culto.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS louvor_studio_expiracao_culto ON public.louvor_studio_projetos;
CREATE TRIGGER louvor_studio_expiracao_culto
  BEFORE INSERT OR UPDATE OF escala_id, expira_em, status ON public.louvor_studio_projetos
  FOR EACH ROW EXECUTE FUNCTION public.louvor_studio_fixar_expiracao_culto();

CREATE OR REPLACE FUNCTION public.louvor_studio_recalcular_vinculo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.studio_projeto_id IS NOT NULL THEN
    UPDATE public.louvor_studio_projetos SET expira_em = expira_em
    WHERE id = OLD.studio_projeto_id;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.studio_projeto_id IS NOT NULL THEN
    UPDATE public.louvor_studio_projetos SET expira_em = expira_em
    WHERE id = NEW.studio_projeto_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS louvor_studio_retencao_vinculo ON public.escala_musicas;
CREATE TRIGGER louvor_studio_retencao_vinculo
  AFTER INSERT OR DELETE OR UPDATE OF studio_projeto_id, escala_id ON public.escala_musicas
  FOR EACH ROW EXECUTE FUNCTION public.louvor_studio_recalcular_vinculo();

CREATE OR REPLACE FUNCTION public.louvor_studio_recalcular_data_culto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.louvor_studio_projetos p SET expira_em = p.expira_em
  WHERE p.escala_id = NEW.id OR EXISTS (
    SELECT 1 FROM public.escala_musicas em
    WHERE em.escala_id = NEW.id AND em.studio_projeto_id = p.id
  );
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS louvor_studio_retencao_data ON public.escalas;
CREATE TRIGGER louvor_studio_retencao_data
  AFTER UPDATE OF data ON public.escalas
  FOR EACH ROW WHEN (OLD.data IS DISTINCT FROM NEW.data)
  EXECUTE FUNCTION public.louvor_studio_recalcular_data_culto();

REVOKE ALL ON FUNCTION public.louvor_studio_expiracao_cultos(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.louvor_studio_fixar_expiracao_culto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.louvor_studio_recalcular_vinculo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.louvor_studio_recalcular_data_culto() FROM PUBLIC, anon, authenticated;

-- Atomically win against rescheduling before touching R2. A crashed cleanup
-- can be reclaimed after 15 minutes; its audio must never be reused meanwhile.
CREATE OR REPLACE FUNCTION public.claim_louvor_studio_cleanup(p_id UUID, p_expira TIMESTAMPTZ)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE projeto public.louvor_studio_projetos%ROWTYPE; inicio TIMESTAMPTZ;
BEGIN
  SELECT * INTO projeto FROM public.louvor_studio_projetos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR projeto.expira_em IS DISTINCT FROM p_expira
    OR projeto.expira_em >= clock_timestamp()
    OR projeto.status NOT IN ('concluido', 'erro', 'aguardando')
    OR projeto.limpeza_em > clock_timestamp() - interval '15 minutes'
    OR EXISTS (SELECT 1 FROM public.louvor_studio_versions WHERE projeto_id = p_id AND status = 'processando')
  THEN RETURN NULL; END IF;
  inicio := clock_timestamp();
  UPDATE public.louvor_studio_projetos SET limpeza_em = inicio WHERE id = p_id;
  RETURN inicio;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_louvor_studio_cleanup(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_louvor_studio_cleanup(UUID, TIMESTAMPTZ) TO service_role;

-- Backfill only service-linked preparations. Personal/free rehearsals keep
-- their existing retention. This migration deletes no records or audio.
UPDATE public.louvor_studio_projetos p SET expira_em = p.expira_em
WHERE p.escala_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.escala_musicas em WHERE em.studio_projeto_id = p.id
);
