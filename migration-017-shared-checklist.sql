-- Migration 017: the application checklist is shared with the whole family (#70, Oct 11).
-- Before this it was saved on one phone only, so a tick by Zoe didn't show for her parents.
-- SCHEMA ONLY: one new nullable column on board schools. No existing rows change. Run AFTER 016.
-- The existing "family edits schools" rule already lets family members update their own board rows.
alter table public.family_schools add column if not exists checklist jsonb
  check (checklist is null or (jsonb_typeof(checklist) = 'object' and octet_length(checklist::text) < 4000));
