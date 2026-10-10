-- Zoe's Colleges M4: cloud Binder (saved chats) + public shareable list links.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ============ BINDER (family-shared saved chats) ============
create table if not exists public.binder_chats (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_id text,
  title text,
  msgs jsonb not null default '[]'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists binder_chats_family_idx on public.binder_chats(family_id);
alter table public.binder_chats enable row level security;

drop policy if exists "family reads binder" on public.binder_chats;
create policy "family reads binder" on public.binder_chats
  for select using (family_id = public.my_family_id());

drop policy if exists "family adds binder" on public.binder_chats;
create policy "family adds binder" on public.binder_chats
  for insert with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "owner removes binder" on public.binder_chats;
create policy "owner removes binder" on public.binder_chats
  for delete using (family_id = public.my_family_id() and created_by = auth.uid());

-- ============ SHARES (public read-only list snapshots) ============
create table if not exists public.shares (
  token text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null default 'list',
  title text,
  payload jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;

-- Family members create their own shares; owners can delete. No public SELECT
-- policy (so nobody can enumerate the table) — reads go through get_share() below.
drop policy if exists "family creates shares" on public.shares;
create policy "family creates shares" on public.shares
  for insert with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "owner deletes shares" on public.shares;
create policy "owner deletes shares" on public.shares
  for delete using (created_by = auth.uid());

-- Anonymous visitors fetch a single share by its exact token (no enumeration).
create or replace function public.get_share(t text)
  returns jsonb language sql security definer set search_path = public as
$$ select payload from public.shares where token = t $$;
grant execute on function public.get_share(text) to anon, authenticated;
