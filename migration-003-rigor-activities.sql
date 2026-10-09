-- Zoe's Colleges M3: add course rigor + activities to profiles so they sync across the family.
-- Safe to run once in the Supabase SQL editor (idempotent). Until this runs, the app stores
-- rigor + activities on each person's device (localStorage) and still uses them for chances.

alter table public.profiles add column if not exists rigor jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists activities jsonb default '[]'::jsonb;
