-- Zoe's Colleges M2: student profiles, preference sliders, and campus photos.
-- Safe to run once in the Supabase SQL editor (idempotent). Reuses my_family_id() from M1.
-- After this runs, profiles/sliders/photos sync across the whole family instead of
-- living only on each person's device.

-- ============ PROFILES ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  gpa text, sat text, act text, major text, rank text, home_state text, notes text,
  updated_at timestamptz not null default now()
);
create index if not exists profiles_family_idx on public.profiles(family_id);

-- ============ PREFERENCES (sliders) ============
create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists preferences_family_idx on public.preferences(family_id);

-- ============ PHOTOS (metadata; bytes live in Storage) ============
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text, url text, caption text,
  created_at timestamptz not null default now()
);
create index if not exists photos_family_school_idx on public.photos(family_id, school_id);

-- ============ RLS ============
alter table public.profiles    enable row level security;
alter table public.preferences enable row level security;
alter table public.photos      enable row level security;

-- profiles: family can read everyone's; each person writes only their own
drop policy if exists "family reads profiles" on public.profiles;
create policy "family reads profiles" on public.profiles for select using (family_id = public.my_family_id());
drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (user_id = auth.uid());

-- preferences: same rule
drop policy if exists "family reads prefs" on public.preferences;
create policy "family reads prefs" on public.preferences for select using (family_id = public.my_family_id());
drop policy if exists "write own prefs" on public.preferences;
create policy "write own prefs" on public.preferences for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "update own prefs" on public.preferences;
create policy "update own prefs" on public.preferences for update using (user_id = auth.uid());

-- photos: family reads all; each person adds/removes their own
drop policy if exists "family reads photos" on public.photos;
create policy "family reads photos" on public.photos for select using (family_id = public.my_family_id());
drop policy if exists "add own photo" on public.photos;
create policy "add own photo" on public.photos for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "remove own photo" on public.photos;
create policy "remove own photo" on public.photos for delete using (user_id = auth.uid() and family_id = public.my_family_id());

-- ============ STORAGE BUCKET for photos ============
insert into storage.buckets (id, name, public)
values ('campus-photos','campus-photos', true)
on conflict (id) do nothing;

-- Public read (URLs are unguessable); authenticated family members write/delete in their family's folder.
drop policy if exists "campus-photos public read" on storage.objects;
create policy "campus-photos public read" on storage.objects
  for select using (bucket_id = 'campus-photos');

drop policy if exists "campus-photos family upload" on storage.objects;
create policy "campus-photos family upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campus-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);

drop policy if exists "campus-photos family delete" on storage.objects;
create policy "campus-photos family delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'campus-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);
