
-- Enums
DO $$ BEGIN
  CREATE TYPE public.company_size AS ENUM ('individual','1-5','6-20','21-100','100+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_role AS ENUM ('owner','steward','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.voice_update_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  size public.company_size NOT NULL DEFAULT 'individual',
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6)),
  approved_voice JSONB NOT NULL DEFAULT '{"opening":"","observations":[]}'::jsonb,
  pending_voice JSONB,
  voice_status TEXT NOT NULL DEFAULT 'learning',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- company_members
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_company_members_user ON public.company_members(user_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);

-- Helper: is caller a member of company?
CREATE OR REPLACE FUNCTION public.is_company_member(_company UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_company_steward(_company UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members
    WHERE company_id = _company AND user_id = auth.uid() AND role IN ('owner','steward'));
$$;

-- companies policies
CREATE POLICY "members view their company" ON public.companies FOR SELECT
  USING (public.is_company_member(id));
CREATE POLICY "authenticated create company" ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "stewards update company" ON public.companies FOR UPDATE
  USING (public.is_company_steward(id)) WITH CHECK (public.is_company_steward(id));

-- company_members policies
CREATE POLICY "members view their peers" ON public.company_members FOR SELECT
  USING (public.is_company_member(company_id));
CREATE POLICY "users insert their own membership" ON public.company_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stewards manage memberships" ON public.company_members FOR UPDATE
  USING (public.is_company_steward(company_id)) WITH CHECK (public.is_company_steward(company_id));
CREATE POLICY "stewards remove members" ON public.company_members FOR DELETE
  USING (public.is_company_steward(company_id));

-- voice_materials
CREATE TABLE public.voice_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  kind TEXT NOT NULL DEFAULT 'paste',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_materials TO authenticated;
GRANT ALL ON public.voice_materials TO service_role;
ALTER TABLE public.voice_materials ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_materials_company ON public.voice_materials(company_id);
CREATE POLICY "members view materials" ON public.voice_materials FOR SELECT
  USING (public.is_company_member(company_id));
CREATE POLICY "stewards add materials" ON public.voice_materials FOR INSERT
  WITH CHECK (public.is_company_steward(company_id) AND auth.uid() = uploaded_by);
CREATE POLICY "stewards remove materials" ON public.voice_materials FOR DELETE
  USING (public.is_company_steward(company_id));

-- voice_feedback
CREATE TABLE public.voice_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  brief TEXT NOT NULL,
  chosen_text TEXT NOT NULL,
  other_texts JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  learned TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_feedback TO authenticated;
GRANT ALL ON public.voice_feedback TO service_role;
ALTER TABLE public.voice_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_feedback_company ON public.voice_feedback(company_id);
CREATE POLICY "members view feedback" ON public.voice_feedback FOR SELECT
  USING (public.is_company_member(company_id));
CREATE POLICY "members add feedback" ON public.voice_feedback FOR INSERT
  WITH CHECK (public.is_company_member(company_id) AND auth.uid() = user_id);

-- voice_updates
CREATE TABLE public.voice_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  proposal JSONB NOT NULL,
  rationale TEXT,
  status public.voice_update_status NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_updates TO authenticated;
GRANT ALL ON public.voice_updates TO service_role;
ALTER TABLE public.voice_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_updates_company ON public.voice_updates(company_id);
CREATE POLICY "members view updates" ON public.voice_updates FOR SELECT
  USING (public.is_company_member(company_id));
CREATE POLICY "stewards create updates" ON public.voice_updates FOR INSERT
  WITH CHECK (public.is_company_steward(company_id) AND auth.uid() = created_by);
CREATE POLICY "stewards decide updates" ON public.voice_updates FOR UPDATE
  USING (public.is_company_steward(company_id)) WITH CHECK (public.is_company_steward(company_id));
