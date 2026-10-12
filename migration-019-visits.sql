-- Migration 019: campus visits are shared with the family (#78, Oct 11). Before this, visit dates, notes, stars and
-- map pins were saved on ONE device only, so the rest of the family never saw them and a new phone lost them.
-- Also holds PAST visits (schools you saw before using the app, even ones not on your board).
-- Run AFTER 018.
--
-- Oct 12 fix: migration 001 already created an older public.visits table (id, visit_date, notes, created_by) that
-- the app never used. "create table if not exists" would have skipped and the new code could not save.
-- So step 1 SETS THE OLD TABLE ASIDE by renaming it to visits_legacy_001 (nothing is deleted; its rows, if any,
-- stay there). Only runs if the old shape is found, so running this twice is safe.
-- Undo: drop the new public.visits, then rename visits_legacy_001 back to visits.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='visits' and column_name='visit_date') then
    alter table public.visits rename to visits_legacy_001;
    alter table public.visits_legacy_001 rename constraint visits_pkey to visits_legacy_001_pkey;
    alter index if exists public.visits_family_idx rename to visits_legacy_001_family_idx;
  end if;
end $$;

create table if not exists public.visits (
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null check (char_length(school_id) between 1 and 80),
  visit jsonb not null check (jsonb_typeof(visit) = 'object' and octet_length(visit::text) < 30000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (family_id, school_id)
);
alter table public.visits enable row level security;
drop policy if exists "family reads visits" on public.visits;
create policy "family reads visits" on public.visits for select using (family_id = public.my_family_id());
drop policy if exists "family adds visits" on public.visits;
create policy "family adds visits" on public.visits for insert with check (family_id = public.my_family_id());
drop policy if exists "family edits visits" on public.visits;
create policy "family edits visits" on public.visits for update using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
drop policy if exists "family removes visits" on public.visits;
create policy "family removes visits" on public.visits for delete using (family_id = public.my_family_id());
grant select, insert, update, delete on public.visits to authenticated;
