-- Migration 018: Discover swipes (#71, Oct 11). Each person's Yes / Maybe / No on a school, shared with the family
-- so the app can show matches ("you and Zoe both liked Elon"). SCHEMA + POLICIES only; one new empty table.
create table if not exists public.swipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null check (char_length(school_id) between 1 and 80),
  verdict text not null check (verdict in ('yes','maybe','no')),
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);
create index if not exists swipes_family on public.swipes(family_id);
alter table public.swipes enable row level security;
drop policy if exists "family reads swipes" on public.swipes;
create policy "family reads swipes" on public.swipes for select using (family_id = public.my_family_id());
drop policy if exists "add own swipe" on public.swipes;
create policy "add own swipe" on public.swipes for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "change own swipe" on public.swipes;
create policy "change own swipe" on public.swipes for update using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "remove own swipe" on public.swipes;
create policy "remove own swipe" on public.swipes for delete using (user_id = auth.uid());
