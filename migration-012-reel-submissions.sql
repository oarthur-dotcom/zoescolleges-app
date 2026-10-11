-- Migration 012: families can offer their visit reel to be shown to other families (#47, Oct 11).
-- SCHEMA + POLICIES ONLY: one new empty table. Nothing is public: every submission starts as 'pending' and is only
-- shown after Obie reviews it. Families can see and withdraw their own submissions.
create table if not exists public.reel_submissions (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_ids text[] not null,                 -- the family's own photos (public.photos ids) they chose to share
  school_ids text[] not null default '{}',
  show_as text not null default 'anonymous' check (show_as in ('anonymous','family')),
  family_label text,                         -- e.g. "The Arthur family" when show_as = 'family'
  note text,                                 -- optional message to other families (max 300 chars)
  consent jsonb not null,                    -- the three boxes they ticked, with the time
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.reel_submissions enable row level security;
drop policy if exists "add own reel submission" on public.reel_submissions;
create policy "add own reel submission" on public.reel_submissions for insert
  with check (user_id = auth.uid() and family_id = public.my_family_id() and status = 'pending');
drop policy if exists "read own family reel submissions" on public.reel_submissions;
create policy "read own family reel submissions" on public.reel_submissions for select using (family_id = public.my_family_id());
drop policy if exists "withdraw own reel submission" on public.reel_submissions;
create policy "withdraw own reel submission" on public.reel_submissions for update
  using (family_id = public.my_family_id()) with check (family_id = public.my_family_id() and status = 'withdrawn');
-- Approving (status = 'approved') is done by Obie in the Supabase dashboard; no browser can approve.
