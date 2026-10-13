-- M22: family income moves out of the family-readable `preferences` row into a private table.
-- Additive and idempotent: nothing is removed here. (The old keys are stripped AFTER the new app is live — see bottom.)
-- Kids get adjusted prices through a rounded, band-level RPC; they never read the income row.

create table if not exists public.family_finance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  income_exact numeric,
  band int,
  kids int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.family_finance enable row level security;

drop policy if exists "own finance read" on public.family_finance;
create policy "own finance read" on public.family_finance for select using (user_id = auth.uid());
drop policy if exists "parent finance insert" on public.family_finance;
create policy "parent finance insert" on public.family_finance for insert
  with check (user_id = auth.uid() and family_id = public.my_family_id()
    and exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'parent'));
drop policy if exists "parent finance update" on public.family_finance;
create policy "parent finance update" on public.family_finance for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "own finance delete" on public.family_finance;
create policy "own finance delete" on public.family_finance for delete using (user_id = auth.uid());

-- What anyone in the family may know: a band, a rounded income (nearest $10k, used only to price schools), kids in college.
create or replace function public.family_pricing()
returns table(band int, income_rounded numeric, kids int)
language sql stable security definer set search_path = public as $$
  select coalesce(f.band, case when f.income_exact is null then null
           when f.income_exact <= 30000 then 0 when f.income_exact <= 48000 then 1
           when f.income_exact <= 75000 then 2 when f.income_exact <= 110000 then 3 else 4 end),
         case when f.income_exact > 0 then round(f.income_exact / 10000) * 10000 end,
         f.kids
  from public.family_finance f
  where f.family_id = public.my_family_id()
  order by (f.income_exact is not null) desc, f.updated_at desc
  limit 1;
$$;
revoke all on function public.family_pricing() from public;
grant execute on function public.family_pricing() to authenticated;

-- Copy what already exists (Obie's row) into the private table.
insert into public.family_finance (user_id, family_id, income_exact, band, kids)
select p.user_id, p.family_id,
  case when (p.weights->>'incomeExact') ~ '^[0-9]+(\.[0-9]+)?$' then (p.weights->>'incomeExact')::numeric end,
  case when (p.weights->>'incomeBand') ~ '^[0-9]+$' then (p.weights->>'incomeBand')::int end,
  coalesce(nullif(p.weights->>'kidsInCollege','')::int, 1)
from public.preferences p
where (p.weights ? 'incomeExact' or p.weights ? 'incomeBand')
on conflict (user_id) do nothing;

-- RUN AFTER THE NEW APP IS LIVE (separate step):
--   update public.preferences set weights = weights - 'incomeExact' - 'incomeBand' - 'kidsInCollege';
