
CREATE TABLE public.landing_tastes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.landing_tastes TO service_role;

ALTER TABLE public.landing_tastes ENABLE ROW LEVEL SECURITY;

CREATE INDEX landing_tastes_ip_hash_created_at_idx
  ON public.landing_tastes (ip_hash, created_at DESC);
CREATE INDEX landing_tastes_created_at_idx
  ON public.landing_tastes (created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'landing-tastes-cleanup',
  '17 3 * * *',
  $$DELETE FROM public.landing_tastes WHERE created_at < now() - INTERVAL '48 hours';$$
);
