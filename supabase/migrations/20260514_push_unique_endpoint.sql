-- A push endpoint belongs to one browser/device at a time.
-- Keep the newest owner to prevent notifications for another account
-- appearing on the current user's device after account switching.

DELETE FROM public.push_subscriptions p
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY criado_em DESC, id DESC) AS rn
  FROM public.push_subscriptions
) r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);