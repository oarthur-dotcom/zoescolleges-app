-- Migration 021: each person's personal school ranking now lives in the database (was saved only on one device).
-- SCHEMA + POLICIES only; one new empty table. Existing rankings on a device are uploaded by the app the first time that person signs in.
-- Take a manual database export first (free Supabase plan has no automatic backups).
create table if not exists public.school_ranks (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null check (char_length(school_id) between 1 and 80),
  rank int not null check (rank between 1 and 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, school_id)
);
create index if not exists school_ranks_family on public.school_ranks(family_id);
alter table public.school_ranks enable row level security;
drop policy if exists "family reads ranks" on public.school_ranks;
create policy "family reads ranks" on public.school_ranks for select using (family_id = public.my_family_id());
drop policy if exists "add own rank" on public.school_ranks;
create policy "add own rank" on public.school_ranks for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "change own rank" on public.school_ranks;
create policy "change own rank" on public.school_ranks for update using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "remove own rank" on public.school_ranks;
create policy "remove own rank" on public.school_ranks for delete using (user_id = auth.uid());
