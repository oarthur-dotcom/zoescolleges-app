-- Zoe's Colleges M1 schema: families, members, schools, ratings, visits
-- Per-member rating locks enforced by Row Level Security.

create extension if not exists pgcrypto;

-- ============ TABLES ============
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free','family','family_plus')),
  invite_code text not null unique default encode(gen_random_bytes(6),'hex'),
  referral_code text not null unique default encode(gen_random_bytes(4),'hex'),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null default 'parent' check (role in ('parent','student')),
  display_name text not null,
  created_at timestamptz not null default now()
);
create index members_family_idx on public.members(family_id);

create table public.family_schools (
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null,            -- Scorecard UNITID, or 'custom-<slug>'
  name text not null,
  city text, state text, url text,
  is_custom boolean not null default false,
  position int not null default 0,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (family_id, school_id)
);

create table public.ratings (
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  note text,
  updated_at timestamptz not null default now(),
  primary key (family_id, school_id, user_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text not null,
  visit_date date,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index visits_family_idx on public.visits(family_id);

-- ============ HELPERS ============
create or replace function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as
$$ select family_id from public.members where user_id = auth.uid() $$;

-- Create a family and join it as the first parent (bypasses RLS chicken-and-egg)
create or replace function public.create_family(family_name text, my_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already in a family';
  end if;
  insert into families (name, created_by) values (family_name, auth.uid()) returning id into fid;
  insert into members (user_id, family_id, role, display_name)
    values (auth.uid(), fid, 'parent', my_name);
  return fid;
end $$;

-- Join an existing family by invite code
create or replace function public.join_family(code text, my_name text, my_role text default 'parent')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid; seat_count int; fam_plan text;
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
    values (auth.uid(), fid, coalesce(my_role,'parent'), my_name);
  return fid;
end $$;

-- ============ ROW LEVEL SECURITY ============
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.family_schools enable row level security;
alter table public.ratings enable row level security;
alter table public.visits enable row level security;

create policy "members see their family" on public.families
  for select using (id = public.my_family_id());
create policy "members update their family" on public.families
  for update using (id = public.my_family_id());

create policy "see fellow members" on public.members
  for select using (family_id = public.my_family_id());
create policy "edit own member row" on public.members
  for update using (user_id = auth.uid());

create policy "family reads schools" on public.family_schools
  for select using (family_id = public.my_family_id());
create policy "family adds schools" on public.family_schools
  for insert with check (family_id = public.my_family_id() and added_by = auth.uid());
create policy "family edits schools" on public.family_schools
  for update using (family_id = public.my_family_id());
create policy "family removes schools" on public.family_schools
  for delete using (family_id = public.my_family_id());

-- THE CORE RULE: everyone in the family can READ all ratings,
-- but each person can only WRITE their own.
create policy "family reads all ratings" on public.ratings
  for select using (family_id = public.my_family_id());
create policy "write only own rating" on public.ratings
  for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
create policy "update only own rating" on public.ratings
  for update using (user_id = auth.uid());
create policy "delete only own rating" on public.ratings
  for delete using (user_id = auth.uid());

create policy "family reads visits" on public.visits
  for select using (family_id = public.my_family_id());
create policy "family adds visits" on public.visits
  for insert with check (family_id = public.my_family_id() and created_by = auth.uid());
create policy "family edits visits" on public.visits
  for update using (family_id = public.my_family_id());
create policy "family removes visits" on public.visits
  for delete using (family_id = public.my_family_id());
