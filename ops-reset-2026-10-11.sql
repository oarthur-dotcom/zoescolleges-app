-- FRESH START for Zoe's Colleges (Oct 11). Asked for by Obie: "clear users including me".
-- 1) BACKS UP every account and all family data into a private backup area (backup_20261011).
-- 2) Checks the backup is complete. If not, it STOPS and nothing is deleted.
-- 3) Deletes all accounts (including Obie's) and all family data. Your beta code is KEPT.
-- All-or-nothing: if any step fails, nothing changes.
begin;
create schema if not exists backup_20261011;
revoke all on schema backup_20261011 from public, anon, authenticated;
create table backup_20261011.users as select id, email, created_at, last_sign_in_at, raw_user_meta_data from auth.users;
create table backup_20261011.families as select * from public.families;
create table backup_20261011.members as select * from public.members;
create table backup_20261011.family_schools as select * from public.family_schools;
create table backup_20261011.ratings as select * from public.ratings;
create table backup_20261011.visits as select * from public.visits;
create table backup_20261011.profiles as select * from public.profiles;
create table backup_20261011.preferences as select * from public.preferences;
create table backup_20261011.photos as select * from public.photos;
create table backup_20261011.binder_chats as select * from public.binder_chats;
create table backup_20261011.shares as select * from public.shares;
create table backup_20261011.reminder_prefs as select * from public.reminder_prefs;
create table backup_20261011.reel_submissions as select * from public.reel_submissions;
create table backup_20261011.ai_usage as select * from public.ai_usage;

do $$ begin
  if (select count(*) from backup_20261011.users) <> (select count(*) from auth.users)
  or (select count(*) from backup_20261011.families) <> (select count(*) from public.families)
  or (select count(*) from backup_20261011.family_schools) <> (select count(*) from public.family_schools)
  or (select count(*) from backup_20261011.ratings) <> (select count(*) from public.ratings)
  or (select count(*) from backup_20261011.profiles) <> (select count(*) from public.profiles)
  then raise exception 'Backup incomplete - nothing was deleted.'; end if;
end $$;

delete from public.families;          -- also removes members, board schools, ratings, visits, photos rows, chats, shares tied to families
delete from public.profiles;
delete from public.preferences;
delete from public.reminder_prefs;
delete from public.reel_submissions;
delete from public.ai_usage;
delete from auth.users;               -- every account, including Obie's

do $$ begin
  if (select count(*) from auth.users) <> 0 or (select count(*) from public.families) <> 0
  then raise exception 'Reset did not finish - nothing was changed.'; end if;
  if not exists (select 1 from private.beta_codes where active)
  then raise exception 'Beta code missing - nothing was changed.'; end if;
end $$;
commit;
