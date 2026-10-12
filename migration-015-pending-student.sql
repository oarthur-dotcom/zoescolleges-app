-- Migration 015: a parent can set up the student before the student joins (#64, Oct 11).
-- One new empty table. No existing rows change. Run AFTER 014.
-- How it works: a parent adds the student's first name (and optionally grades). The profile is held here for the family.
-- When the student joins with the invite and their own profile is still empty, the app copies it to their account
-- and removes this row. Family-only: nobody outside the family can see or change it.

create table if not exists public.pending_students (
  family_id uuid primary key references public.families(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) < 20000),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.pending_students enable row level security;
drop policy if exists "family reads pending student" on public.pending_students;
create policy "family reads pending student" on public.pending_students for select using (family_id = public.my_family_id());
drop policy if exists "family adds pending student" on public.pending_students;
create policy "family adds pending student" on public.pending_students for insert with check (family_id = public.my_family_id());
drop policy if exists "family edits pending student" on public.pending_students;
create policy "family edits pending student" on public.pending_students for update using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
drop policy if exists "family removes pending student" on public.pending_students;
create policy "family removes pending student" on public.pending_students for delete using (family_id = public.my_family_id());
