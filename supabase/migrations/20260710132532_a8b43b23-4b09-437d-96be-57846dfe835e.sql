
-- 1. lending_grants first (other tables reference it in policies)
CREATE TABLE public.lending_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email text NOT NULL,
  collaborator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  relationship_label text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'all',
  autonomy text NOT NULL DEFAULT 'always_approve',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX lending_grants_owner_idx ON public.lending_grants(owner_id);
CREATE INDEX lending_grants_collaborator_idx ON public.lending_grants(collaborator_id);
CREATE INDEX lending_grants_email_idx ON public.lending_grants(lower(collaborator_email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lending_grants TO authenticated;
GRANT ALL ON public.lending_grants TO service_role;

ALTER TABLE public.lending_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their grants"
  ON public.lending_grants FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view grants pointed at them"
  ON public.lending_grants FOR SELECT
  USING (auth.uid() = collaborator_id);

-- 2. user_voice_profiles
CREATE TABLE public.user_voice_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opening text NOT NULL DEFAULT '',
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory jsonb NOT NULL DEFAULT '[]'::jsonb,
  drafts_since_check int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_voice_profiles TO authenticated;
GRANT ALL ON public.user_voice_profiles TO service_role;

ALTER TABLE public.user_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own voice profile"
  ON public.user_voice_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Collaborators can read the owner voice profile"
  ON public.user_voice_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lending_grants g
      WHERE g.owner_id = user_voice_profiles.user_id
        AND g.collaborator_id = auth.uid()
        AND g.status = 'active'
    )
  );

CREATE TRIGGER voice_profiles_set_updated_at
  BEFORE UPDATE ON public.user_voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. lending_drafts
CREATE TABLE public.lending_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.lending_grants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief text NOT NULL,
  draft_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  owner_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX lending_drafts_owner_idx ON public.lending_drafts(owner_id, status);
CREATE INDEX lending_drafts_grant_idx ON public.lending_drafts(grant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lending_drafts TO authenticated;
GRANT ALL ON public.lending_drafts TO service_role;

ALTER TABLE public.lending_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read and decide on their drafts"
  ON public.lending_drafts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Collaborators can read their own submissions"
  ON public.lending_drafts FOR SELECT
  USING (auth.uid() = collaborator_id);

CREATE POLICY "Collaborators can insert drafts they authored"
  ON public.lending_drafts FOR INSERT
  WITH CHECK (
    auth.uid() = collaborator_id
    AND EXISTS (
      SELECT 1 FROM public.lending_grants g
      WHERE g.id = lending_drafts.grant_id
        AND g.collaborator_id = auth.uid()
        AND g.owner_id = lending_drafts.owner_id
        AND g.status = 'active'
    )
  );
