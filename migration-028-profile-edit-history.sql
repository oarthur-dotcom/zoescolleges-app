-- Zoe's Colleges M28: a change history for grades, test scores and activities.
-- ADDITIVE: one new table. Each row = one field changed, who changed it, when, old value, new value.
-- Family members can read and add rows; nobody can edit or delete a row (no update/delete policy), so the record stays honest.
create table if not exists public.profile_edits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  profile_owner text not null,
  edited_by uuid not null default auth.uid(),
  edited_by_name text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists profile_edits_family_time on public.profile_edits (family_id, created_at desc);
alter table public.profile_edits enable row level security;
drop policy if exists "family reads edit history" on public.profile_edits;
create policy "family reads edit history" on public.profile_edits for select using (family_id = public.my_family_id());
drop policy if exists "family logs edits" on public.profile_edits;
create policy "family logs edits" on public.profile_edits for insert with check (family_id = public.my_family_id() and edited_by = auth.uid());
-- Rollback: drop table public.profile_edits;
