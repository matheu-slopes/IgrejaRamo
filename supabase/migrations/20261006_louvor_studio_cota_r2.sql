CREATE TABLE IF NOT EXISTS public.louvor_studio_reservas_espaco (
  id UUID PRIMARY KEY,
  bytes BIGINT NOT NULL CHECK (bytes > 0 AND bytes <= 1100000000),
  expira_em TIMESTAMPTZ NOT NULL,
  finalizada_em TIMESTAMPTZ
);
ALTER TABLE public.louvor_studio_reservas_espaco ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.louvor_studio_reservas_espaco FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.louvor_studio_reservas_espaco TO service_role;

CREATE OR REPLACE FUNCTION public.louvor_studio_inicio_medicao()
RETURNS TIMESTAMPTZ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT clock_timestamp(); $$;

CREATE OR REPLACE FUNCTION public.reservar_espaco_louvor_studio(
  p_id UUID, p_bytes BIGINT, p_usados BIGINT, p_inicio TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE reservados BIGINT; limite CONSTANT BIGINT := 8000000000;
BEGIN
  IF p_id IS NULL OR p_bytes IS NULL OR p_bytes <= 0 OR p_bytes > 1100000000 OR p_usados IS NULL OR p_usados < 0
    OR p_inicio IS NULL OR p_inicio > clock_timestamp()
    OR p_inicio < clock_timestamp() - INTERVAL '2 minutes' THEN
    RAISE EXCEPTION 'Medicao ou reserva invalida';
  END IF;
  -- Serialize teams; completed uploads newer than this snapshot retain their
  -- reservation, so a stale listing cannot accidentally release their space.
  PERFORM pg_advisory_xact_lock(hashtextextended('louvor-studio-r2-quota', 0));
  DELETE FROM public.louvor_studio_reservas_espaco WHERE expira_em < clock_timestamp() - INTERVAL '1 day';
  SELECT COALESCE(SUM(bytes), 0) INTO reservados
  FROM public.louvor_studio_reservas_espaco
  WHERE id <> p_id AND expira_em > clock_timestamp()
    AND (finalizada_em IS NULL OR finalizada_em >= p_inicio);
  IF p_usados + reservados + p_bytes > limite THEN
    RETURN jsonb_build_object('permitido', FALSE, 'disponivel', GREATEST(0, limite - p_usados - reservados));
  END IF;
  INSERT INTO public.louvor_studio_reservas_espaco(id, bytes, expira_em, finalizada_em)
  VALUES (p_id, p_bytes, clock_timestamp() + INTERVAL '8 hours', NULL)
  ON CONFLICT (id) DO UPDATE SET bytes = EXCLUDED.bytes, expira_em = EXCLUDED.expira_em, finalizada_em = NULL;
  RETURN jsonb_build_object('permitido', TRUE, 'disponivel', limite - p_usados - reservados - p_bytes);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_reserva_louvor_studio(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('louvor-studio-r2-quota', 0));
  UPDATE public.louvor_studio_reservas_espaco SET finalizada_em = clock_timestamp() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.louvor_studio_inicio_medicao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_espaco_louvor_studio(UUID, BIGINT, BIGINT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalizar_reserva_louvor_studio(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.louvor_studio_inicio_medicao() TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_espaco_louvor_studio(UUID, BIGINT, BIGINT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_reserva_louvor_studio(UUID) TO service_role;
