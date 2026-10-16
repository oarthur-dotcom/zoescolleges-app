-- Migration 025: parents can fill in and adjust the student's grades, and grades a parent entered before the
-- student joined can never be lost when the student joins (bug found Oct 16: Zoe joined, the grades vanished,
-- and parents could no longer add them).
--
-- What was wrong
--   1. Grades entered before the student joined live in public.pending_students. The hand-over to the student's own
--      profile happened in the BROWSER (maybeClaimPending) and the pending row was deleted even when the copy failed
--      or was skipped. Nothing on the server protected them.
--   2. profiles could only be written by their own user, so once the student joined no parent could add or fix grades.
--
-- What this does
--   A. is_family_parent_of(uid): true when the signed-in user is a parent in the same family as that student.
--   B. profiles insert/update: allowed for the owner (as before) OR a parent of that student in the same family.
--      Nobody can move a profile to another family; nobody can delete a profile (still no delete policy).
--   C. join_family(): when a STUDENT joins and the family has a pending profile, the server copies it into the
--      student's profile and removes the pending row in the SAME transaction. If anything fails, the join rolls back
--      and the pending grades stay put.
--
-- Safe to re-run. No existing rows are changed. Run AFTER 024.

-- A. helper ------------------------------------------------------------------------------------------------------
create or replace function public.is_family_parent_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.members me
    join public.members t on t.family_id = me.family_id
    where me.user_id = auth.uid() and me.role = 'parent'
      and t.user_id = target and t.role = 'student'
  )
$$;
revoke all on function public.is_family_parent_of(uuid) from public, anon;
grant execute on function public.is_family_parent_of(uuid) to authenticated;

-- B. policies ----------------------------------------------------------------------------------------------------
drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles for insert
  with check (family_id = public.my_family_id() and (user_id = auth.uid() or public.is_family_parent_of(user_id)));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (user_id = auth.uid() or public.is_family_parent_of(user_id))
  with check (family_id = public.my_family_id() and (user_id = auth.uid() or public.is_family_parent_of(user_id)));

-- C. joining carries the pending grades over, atomically -----------------------------------------------------------
create or replace function public.join_family(code text, my_name text, my_role text default 'parent')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid; seat_count int; fam_plan text; pend public.pending_students%rowtype; role_in text := coalesce(my_role,'parent');
begin
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already in a family';
  end if;
  select id, plan into fid, fam_plan from families where invite_code = lower(code);
  if fid is null then raise exception 'invalid invite code'; end if;
  select count(*) into seat_count from members where family_id = fid;
  if fam_plan = 'free' and seat_count >= 2 then
    raise exception 'free plan is limited to 2 seats';
  end if;
  insert into members (user_id, family_id, role, display_name)
    values (auth.uid(), fid, role_in, my_name);

  if role_in = 'student' then
    select * into pend from public.pending_students where family_id = fid;
    if found then
      if pend.profile <> '{}'::jsonb then
        insert into public.profiles (user_id, family_id, gpa, sat, act, major, rank, home_state, notes, rigor, activities, test_optional, hs, updated_at)
        values (auth.uid(), fid,
                pend.profile->>'gpa', pend.profile->>'sat', pend.profile->>'act', pend.profile->>'major', pend.profile->>'rank',
                pend.profile->>'home_state', pend.profile->>'notes',
                pend.profile->'rigor', pend.profile->'activities',
                case when pend.profile ? 'test_optional' then (pend.profile->>'test_optional')::boolean end,
                pend.profile->'hs', now())
        on conflict (user_id) do nothing;
      end if;
      delete from public.pending_students where family_id = fid;
    end if;
  end if;
  return fid;
end $$;
revoke all on function public.join_family(text, text, text) from public, anon;
grant execute on function public.join_family(text, text, text) to authenticated;
