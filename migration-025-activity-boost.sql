-- Zoe's Colleges M25: the family's own 3-step activities adjustment (0 = Zoe's recommendation, 1 = Higher, 2 = Highest).
-- ADDITIVE and non-destructive: one nullable column, nothing dropped or rewritten. NOT YET RUN - review first,
-- and take a manual Supabase export before applying. Until it runs, the app still works: pending students keep it in
-- their profile JSON, and a signed-in save falls back to the device (localStorage) with the column missing.
alter table public.profiles add column if not exists act_boost smallint default 0 check (act_boost between 0 and 2);
