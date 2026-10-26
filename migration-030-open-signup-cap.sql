-- Migration 030: open sign-up with a daily cap, plus a waitlist (Oct 26). NEEDS OBIE'S OK BEFORE RUNNING.
-- What it does:
--   1. A valid beta code, family invite or referral link still always works (no cap), exactly as migration 007.
--   2. NEW: when private.signup_settings.open = true, a sign-up with no code is allowed until
--      daily_cap new open sign-ups have happened today (Eastern time). After that the server refuses and the app
--      shows "Join the waitlist".
--   3. NEW: public.waitlist (email, when they asked). The browser can only ADD an email (join_waitlist);
--      it cannot read the list. Obie reads it in the owner back office or the Supabase table viewer.
-- Safe default: this migration leaves open = false, so nothing changes until you flip the switch:
--     update private.signup_settings set open = true  where id = 1;     -- open to anyone, capped
--     update private.signup_settings set open = false where id = 1;     -- back to invite-only
--     update private.signup_settings set daily_cap = 50 where id = 1;   -- change the cap (starts at 25)
-- Undo: re-run migration 007's function body (invite-only) and drop table public.waitlist.
-- Existing accounts are untouched. This only checks NEW sign-ups.

create table if not exists private.signup_settings (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  daily_cap int not null default 25 check (daily_cap >= 0)
);
insert into private.signup_settings (id) values (1) on conflict (id) do nothing;

create table if not exists private.open_signups_by_day (
  day date primary key,
  n int not null default 0
);

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254),
  created_at timestamptz not null default now(),
  invited_at timestamptz
);
create unique index if not exists waitlist_email_uniq on public.waitlist (lower(email));
alter table public.waitlist enable row level security;          -- no policies: the browser cannot read or change it
revoke all on public.waitlist from anon, authenticated;

create or replace function public.join_waitlist(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(e) > 254 then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;
  if (select count(*) from public.waitlist) >= 5000 then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  insert into public.waitlist (email) values (e) on conflict (lower(email)) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.join_waitlist(text) from public;
grant execute on function public.join_waitlist(text) to anon, authenticated;

create or replace function private.enforce_beta_gate() returns trigger
language plpgsql security definer set search_path = private, public as $$
declare
  ac text := upper(trim(coalesce(new.raw_user_meta_data->>'access_code', '')));
  jc text := lower(trim(coalesce(new.raw_user_meta_data->>'join_code', '')));
  rc text := lower(trim(coalesce(new.raw_user_meta_data->>'ref_code', '')));
  s private.signup_settings%rowtype;
  today date := (now() at time zone 'America/New_York')::date;
  got int;
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
  -- No valid code. Open sign-up (capped per day) if Obie has switched it on.
  select * into s from private.signup_settings where id = 1;
  if found and s.open then
    insert into private.open_signups_by_day (day, n) values (today, 0) on conflict (day) do nothing;
    update private.open_signups_by_day set n = n + 1 where day = today and n < s.daily_cap returning n into got;
    if got is not null then
      return new;
    end if;
    raise exception 'SIGNUP_CAP: today''s open sign-ups are full';
  end if;
  raise exception 'BETA_GATE: a valid beta access code, family invite or referral is required';
end $$;
-- the trigger from migration 007 already points at this function name; recreate it to be explicit
drop trigger if exists enforce_beta_gate on auth.users;
create trigger enforce_beta_gate before insert on auth.users
  for each row execute function private.enforce_beta_gate();
