-- M24: families can ask for a school's pricing to be refreshed. Obie reads this table (Supabase) and updates by hand.
create table if not exists public.pricing_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id text not null,
  created_at timestamptz not null default now()
);
alter table public.pricing_requests enable row level security;
drop policy if exists "family adds pricing request" on public.pricing_requests;
create policy "family adds pricing request" on public.pricing_requests for insert
  with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "family reads pricing requests" on public.pricing_requests;
create policy "family reads pricing requests" on public.pricing_requests for select using (family_id = public.my_family_id());
