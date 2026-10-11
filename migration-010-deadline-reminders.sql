-- Migration 010: deadline reminder emails (improvement #1, Oct 11).
-- SCHEMA + POLICIES ONLY: creates two new empty tables. No existing rows are touched.
-- reminder_prefs: each person's own on/off switch (off unless they turn it on).
-- reminder_log:   what was sent, so the same reminder is never sent twice.

create table if not exists public.reminder_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  email_on boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.reminder_prefs enable row level security;
drop policy if exists "read own reminder prefs" on public.reminder_prefs;
create policy "read own reminder prefs" on public.reminder_prefs for select using (user_id = auth.uid());
drop policy if exists "add own reminder prefs" on public.reminder_prefs;
create policy "add own reminder prefs" on public.reminder_prefs for insert
  with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "change own reminder prefs" on public.reminder_prefs;
create policy "change own reminder prefs" on public.reminder_prefs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());

create table if not exists public.reminder_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null,
  kind text not null,                 -- e.g. "Early Action", "Regular"
  deadline_date date not null,
  days_before int not null,           -- 30, 14 or 3 (the reminder window)
  sent_at timestamptz not null default now(),
  unique (user_id, school_id, kind, deadline_date, days_before)
);
alter table public.reminder_log enable row level security;
drop policy if exists "read own reminder log" on public.reminder_log;
create policy "read own reminder log" on public.reminder_log for select using (user_id = auth.uid());
-- No browser writes to reminder_log: only the daily server job (service key) records sends.
