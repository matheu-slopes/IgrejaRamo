-- Cota de uploads de mídias do aplicativo; não altera o bucket do Studio.
CREATE TABLE IF NOT EXISTS public.midias_r2_reservas (
  id uuid PRIMARY KEY,
  bytes bigint NOT NULL CHECK (bytes > 0 AND bytes <= 4194304),
  expira_em timestamptz NOT NULL,
  finalizada_em timestamptz
);
ALTER TABLE public.midias_r2_reservas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.midias_r2_reservas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.midias_r2_reservas TO service_role;

CREATE OR REPLACE FUNCTION public.midias_r2_inicio_medicao()
RETURNS timestamptz LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT clock_timestamp(); $$;

CREATE OR REPLACE FUNCTION public.reservar_espaco_midias_r2(
  p_id uuid, p_bytes bigint, p_usados bigint, p_inicio timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE reservados bigint; limite CONSTANT bigint := 1000000000;
BEGIN
  IF p_id IS NULL OR p_bytes IS NULL OR p_bytes <= 0 OR p_bytes > 4194304
     OR p_usados IS NULL OR p_usados < 0 OR p_inicio IS NULL
     OR p_inicio > clock_timestamp() OR p_inicio < clock_timestamp() - INTERVAL '2 minutes' THEN
    RAISE EXCEPTION 'Medição ou reserva inválida';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('midias-r2-quota', 0));
  DELETE FROM public.midias_r2_reservas WHERE expira_em < clock_timestamp() - INTERVAL '1 day';
  SELECT COALESCE(SUM(bytes), 0) INTO reservados FROM public.midias_r2_reservas
    WHERE id <> p_id AND expira_em > clock_timestamp()
      AND (finalizada_em IS NULL OR finalizada_em >= p_inicio);
  IF p_usados + reservados + p_bytes > limite THEN
    RETURN jsonb_build_object('permitido', false, 'disponivel', GREATEST(0, limite - p_usados - reservados));
  END IF;
  INSERT INTO public.midias_r2_reservas(id, bytes, expira_em, finalizada_em)
    VALUES (p_id, p_bytes, clock_timestamp() + INTERVAL '8 hours', NULL)
    ON CONFLICT (id) DO UPDATE SET bytes = EXCLUDED.bytes, expira_em = EXCLUDED.expira_em, finalizada_em = NULL;
  RETURN jsonb_build_object('permitido', true, 'disponivel', limite - p_usados - reservados - p_bytes);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_reserva_midias_r2(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('midias-r2-quota', 0));
  UPDATE public.midias_r2_reservas SET finalizada_em = clock_timestamp() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.midias_r2_inicio_medicao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_espaco_midias_r2(uuid,bigint,bigint,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalizar_reserva_midias_r2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.midias_r2_inicio_medicao() TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_espaco_midias_r2(uuid,bigint,bigint,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_reserva_midias_r2(uuid) TO service_role;

-- Backups e troca condicional das fotos legadas; somente service_role.
CREATE TABLE IF NOT EXISTS public.midias_r2_fotos_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  foto_original text NOT NULL,
  referencia_nova text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.midias_r2_fotos_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.midias_r2_fotos_backup FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.midias_r2_fotos_backup TO service_role;

CREATE OR REPLACE FUNCTION public.migrar_foto_perfil_r2(p_perfil uuid, p_original text, p_nova text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE foto_atual text;
BEGIN
  IF p_perfil IS NULL OR p_original IS NULL OR p_original NOT LIKE 'data:image/%;base64,%'
    OR p_nova IS NULL OR p_nova !~ ('^r2midia:perfis/' || p_perfil::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') THEN
    RAISE EXCEPTION 'Foto ou referência inválida';
  END IF;
  SELECT p.foto INTO foto_atual FROM public.perfis p WHERE p.id = p_perfil FOR UPDATE;
  IF NOT FOUND OR foto_atual IS DISTINCT FROM p_original THEN RETURN false; END IF;
  INSERT INTO public.midias_r2_fotos_backup(perfil_id, foto_original, referencia_nova) VALUES (p_perfil, p_original, p_nova);
  UPDATE public.perfis SET foto = p_nova WHERE id = p_perfil;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.migrar_foto_perfil_r2(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrar_foto_perfil_r2(uuid,text,text) TO service_role;
