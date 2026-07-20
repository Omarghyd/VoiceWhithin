
CREATE TABLE public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  tokens_used bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

GRANT SELECT ON public.user_usage TO authenticated;
GRANT ALL ON public.user_usage TO service_role;

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
ON public.user_usage FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER user_usage_set_updated_at
BEFORE UPDATE ON public.user_usage
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
