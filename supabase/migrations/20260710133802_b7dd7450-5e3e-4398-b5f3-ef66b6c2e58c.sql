
alter table public.user_voice_profiles
  add column if not exists slug text unique,
  add column if not exists is_public boolean not null default false,
  add column if not exists display_name text,
  add column if not exists signature_passage text,
  add column if not exists published_at timestamptz;

-- Allow anonymous reads only for published cards.
drop policy if exists "Public voice cards are readable" on public.user_voice_profiles;
create policy "Public voice cards are readable"
  on public.user_voice_profiles
  for select
  to anon, authenticated
  using (is_public = true);

grant select on public.user_voice_profiles to anon;

-- Helper to mint short URL-safe slugs.
create or replace function public.generate_voice_slug()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  candidate text;
  exists_already boolean;
begin
  loop
    candidate := lower(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
    candidate := regexp_replace(candidate, '[^a-z0-9]', '', 'g');
    if length(candidate) < 6 then
      continue;
    end if;
    select exists(select 1 from public.user_voice_profiles where slug = candidate) into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;
