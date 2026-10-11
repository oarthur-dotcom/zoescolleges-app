-- Migration 011: weekly Campus Pulse email (#34, Oct 11).
-- SCHEMA + POLICIES ONLY. Adds one column (default OFF) to reminder_prefs and one new empty table.
-- No existing rows are changed. Run AFTER migration 010.

alter table public.reminder_prefs add column if not exists pulse_weekly boolean not null default false;
-- (reminder_prefs policies from migration 010 already limit each person to their own row.)

create table if not exists public.pulse_weekly_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null,           -- Monday of the week the email covers
  sent_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.pulse_weekly_log enable row level security;
drop policy if exists "read own pulse weekly log" on public.pulse_weekly_log;
create policy "read own pulse weekly log" on public.pulse_weekly_log for select using (user_id = auth.uid());
-- No browser writes to pulse_weekly_log: only the weekly server job (service key) records sends.
