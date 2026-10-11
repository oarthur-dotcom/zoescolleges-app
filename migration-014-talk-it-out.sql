-- Migration 014: Talk It Out (#60, Oct 11). Everyone's voice, reactions, and a secret family ballot.
-- SCHEMA + POLICIES + 3 small functions. Creates new empty tables only; no existing rows change. Run AFTER 013.
-- Privacy: family members see each other's voices and posts (that's the point), never another family's.
-- Ballots are SECRET: you can read only your own until your family reveals the results.

create table if not exists public.talk_posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id text,                                        -- null = a general family topic
  kind text not null default 'post' check (kind in ('voice','post','agreement')),
  feel text check (feel in ('love','worry','wonder','need')),
  body text not null check (char_length(body) between 1 and 800),
  in_movie boolean not null default true,                -- "OK to include in our movie"
  reply_to uuid references public.talk_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists talk_posts_family on public.talk_posts(family_id, created_at);
alter table public.talk_posts enable row level security;
drop policy if exists "family reads talk" on public.talk_posts;
create policy "family reads talk" on public.talk_posts for select using (family_id = public.my_family_id());
drop policy if exists "add own talk" on public.talk_posts;
create policy "add own talk" on public.talk_posts for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "edit own talk" on public.talk_posts;
create policy "edit own talk" on public.talk_posts for update using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "delete own talk" on public.talk_posts;
create policy "delete own talk" on public.talk_posts for delete using (user_id = auth.uid());

create table if not exists public.talk_reactions (
  post_id uuid not null references public.talk_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  emoji text not null check (emoji in ('heard','fair','more','love')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
alter table public.talk_reactions enable row level security;
drop policy if exists "family reads reactions" on public.talk_reactions;
create policy "family reads reactions" on public.talk_reactions for select using (family_id = public.my_family_id());
drop policy if exists "add own reaction" on public.talk_reactions;
create policy "add own reaction" on public.talk_reactions for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "remove own reaction" on public.talk_reactions;
create policy "remove own reaction" on public.talk_reactions for delete using (user_id = auth.uid());

-- Secret ballot: each person's private ranking (school ids, best first, up to 10).
create table if not exists public.family_ballots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  ranks jsonb not null check (jsonb_typeof(ranks) = 'array' and jsonb_array_length(ranks) between 1 and 10),
  submitted_at timestamptz not null default now()
);
alter table public.family_ballots enable row level security;
drop policy if exists "read own ballot" on public.family_ballots;
create policy "read own ballot" on public.family_ballots for select using (user_id = auth.uid());
drop policy if exists "cast own ballot" on public.family_ballots;
create policy "cast own ballot" on public.family_ballots for insert with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "change own ballot" on public.family_ballots;
create policy "change own ballot" on public.family_ballots for update using (user_id = auth.uid()) with check (user_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "withdraw own ballot" on public.family_ballots;
create policy "withdraw own ballot" on public.family_ballots for delete using (user_id = auth.uid());

create table if not exists public.ballot_reveals (
  family_id uuid primary key references public.families(id) on delete cascade,
  revealed_by uuid references auth.users(id) on delete set null,
  revealed_at timestamptz not null default now()
);
alter table public.ballot_reveals enable row level security;
drop policy if exists "family reads reveal" on public.ballot_reveals;
create policy "family reads reveal" on public.ballot_reveals for select using (family_id = public.my_family_id());
-- (Reveals are written only through ballot_reveal() below.)

-- Results: counts always; everyone's ballots only once revealed (or once everyone has voted).
create or replace function public.ballot_results() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); n int; v int; rev boolean;
begin
  if fid is null then return null; end if;
  select count(*) into n from public.members where family_id = fid;
  select count(*) into v from public.family_ballots where family_id = fid;
  rev := exists (select 1 from public.ballot_reveals where family_id = fid) or (v > 0 and v >= n);
  return jsonb_build_object('members', n, 'voted', v, 'revealed', rev,
    'voters', (select coalesce(jsonb_agg(user_id), '[]'::jsonb) from public.family_ballots where family_id = fid),
    'ballots', case when rev then (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'ranks', ranks)), '[]'::jsonb) from public.family_ballots where family_id = fid) else null end);
end $$;

create or replace function public.ballot_reveal() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id();
begin
  if fid is null then raise exception 'not in a family'; end if;
  insert into public.ballot_reveals (family_id, revealed_by) values (fid, auth.uid()) on conflict (family_id) do nothing;
end $$;

-- New round: clears this family's ballots and the reveal (votes only; voices and talk are kept).
create or replace function public.ballot_new_round() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id();
begin
  if fid is null then raise exception 'not in a family'; end if;
  delete from public.family_ballots where family_id = fid;
  delete from public.ballot_reveals where family_id = fid;
end $$;

revoke all on function public.ballot_results() from public, anon;
revoke all on function public.ballot_reveal() from public, anon;
revoke all on function public.ballot_new_round() from public, anon;
grant execute on function public.ballot_results() to authenticated;
grant execute on function public.ballot_reveal() to authenticated;
grant execute on function public.ballot_new_round() to authenticated;
