-- Migration 006: close family-hopping and free-upgrade holes (audit Oct 11, #2 and #3).
-- PERMISSIONS ONLY. No rows are inserted, updated or deleted.
-- Safe to re-run.

-- 1) Members may only change their own role and display name — never user_id or family_id.
--    (join_family / create_family are SECURITY DEFINER and are unaffected.)
revoke update on public.members from anon, authenticated;
grant update (role, display_name) on public.members to authenticated;
drop policy if exists "edit own member row" on public.members;
create policy "edit own member row" on public.members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and family_id = public.my_family_id());

-- 2) Nobody edits the families row from the browser (plan, invite code, name).
--    The app never updates families directly; plan changes will come from billing (server).
revoke update on public.families from anon, authenticated;
drop policy if exists "members update their family" on public.families;

-- 3) Every remaining update policy must keep the row inside the caller's own family.
drop policy if exists "update only own rating" on public.ratings;
create policy "update only own rating" on public.ratings
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "family edits schools" on public.family_schools;
create policy "family edits schools" on public.family_schools
  for update using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());

drop policy if exists "family edits visits" on public.visits;
create policy "family edits visits" on public.visits
  for update using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "update own prefs" on public.preferences;
create policy "update own prefs" on public.preferences
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and family_id = public.my_family_id());
