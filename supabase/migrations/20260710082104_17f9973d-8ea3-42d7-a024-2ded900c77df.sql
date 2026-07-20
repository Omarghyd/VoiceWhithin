CREATE TABLE public.teams_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.teams_waitlist TO anon, authenticated;
GRANT ALL ON public.teams_waitlist TO service_role;

ALTER TABLE public.teams_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist"
ON public.teams_waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (true);