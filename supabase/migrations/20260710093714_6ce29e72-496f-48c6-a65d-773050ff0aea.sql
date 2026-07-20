
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_company_member(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company AND user_id = auth.uid()); $$;

CREATE OR REPLACE FUNCTION private.is_company_steward(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.company_members
  WHERE company_id = _company AND user_id = auth.uid() AND role IN ('owner','steward')); $$;

REVOKE ALL ON FUNCTION private.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_company_steward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_company_steward(uuid) TO authenticated, service_role;

DO $$
DECLARE r record; sql text; role_list text; new_qual text; new_check text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname='public'
      AND (qual LIKE '%is_company_member%' OR qual LIKE '%is_company_steward%'
        OR with_check LIKE '%is_company_member%' OR with_check LIKE '%is_company_steward%')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    new_qual := regexp_replace(regexp_replace(coalesce(r.qual,''),
      '(?<![\.\w])is_company_member', 'private.is_company_member', 'g'),
      '(?<![\.\w])is_company_steward', 'private.is_company_steward', 'g');
    new_check := regexp_replace(regexp_replace(coalesce(r.with_check,''),
      '(?<![\.\w])is_company_member', 'private.is_company_member', 'g'),
      '(?<![\.\w])is_company_steward', 'private.is_company_steward', 'g');
    role_list := array_to_string(r.roles, ',');
    sql := format('CREATE POLICY %I ON %I.%I FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename, r.cmd, role_list);
    IF r.qual IS NOT NULL THEN sql := sql || ' USING (' || new_qual || ')'; END IF;
    IF r.with_check IS NOT NULL THEN sql := sql || ' WITH CHECK (' || new_check || ')'; END IF;
    EXECUTE sql;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.is_company_member(uuid);
DROP FUNCTION IF EXISTS public.is_company_steward(uuid);

-- Privilege escalation fix
DROP POLICY IF EXISTS "users insert their own membership" ON public.company_members;
CREATE POLICY "users insert their own membership"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'member');

-- Always-true RLS fix
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.teams_waitlist;
CREATE POLICY "Anyone can join the waitlist"
ON public.teams_waitlist FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (note IS NULL OR char_length(note) <= 2000)
);
