-- Migration 019: campus visits are shared with the family (#78, Oct 11). Before this, visit dates, notes, stars and
-- map pins were saved on ONE device only, so the rest of the family never saw them and a new phone lost them.
-- Also holds PAST visits (schools you saw before using the app, even ones not on your board).
-- SCHEMA + POLICIES only; one new empty table. No existing rows change. Run AFTER 018.
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
