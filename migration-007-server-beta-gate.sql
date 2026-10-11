-- Migration 007: enforce the beta sign-up gate on the server (audit Oct 11, #4).
-- New accounts are created only with a valid beta code, a real family invite code,
-- or a real family referral code (the "share with a friend" link).
-- Existing accounts are untouched (this only checks NEW sign-ups).
-- Codes live in a private table the browser cannot read. No codes are stored in this file:
-- after running it, add your code in the SQL editor:
--     insert into private.beta_codes (code, note) values ('YOURNEWCODE', 'beta wave 1');
-- To retire a code:  update private.beta_codes set active = false where code = 'OLDCODE';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.beta_codes (
  code text primary key check (code = upper(code)),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create or replace function private.enforce_beta_gate() returns trigger
language plpgsql security definer set search_path = private, public as $$
declare
  ac text := upper(trim(coalesce(new.raw_user_meta_data->>'access_code', '')));
  jc text := lower(trim(coalesce(new.raw_user_meta_data->>'join_code', '')));
  rc text := lower(trim(coalesce(new.raw_user_meta_data->>'ref_code', '')));
begin
  if ac <> '' and exists (select 1 from private.beta_codes where code = ac and active) then
    return new;
  end if;
  if jc <> '' and exists (select 1 from public.families where invite_code = jc) then
    return new;
  end if;
  if rc <> '' and exists (select 1 from public.families where referral_code = rc) then
    return new;
  end if;
  raise exception 'BETA_GATE: a valid beta access code, family invite or referral is required';
end $$;

drop trigger if exists enforce_beta_gate on auth.users;
create trigger enforce_beta_gate before insert on auth.users
  for each row execute function private.enforce_beta_gate();
