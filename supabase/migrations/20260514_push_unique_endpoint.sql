-- A push endpoint belongs to one browser/device at a time.
-- Keep the newest owner to prevent notifications for another account
-- appearing on the current user's device after account switching.

DO $$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions p
    USING (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY criado_em DESC, id DESC) AS rn
      FROM public.push_subscriptions
    ) r
    WHERE p.id = r.id
      AND r.rn > 1;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_push_subscriptions_endpoint'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_push_subscriptions_endpoint ON public.push_subscriptions (endpoint)';
    END IF;
  ELSE
    RAISE NOTICE 'public.push_subscriptions not found. Skipping unique endpoint index.';
  END IF;
END $$;