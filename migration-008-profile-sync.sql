-- Migration 008: share test-optional + high-school context across the family (audit Oct 11, #11).
-- SCHEMA ONLY: adds two nullable columns. No rows are changed. Safe to re-run.
-- (rigor + activities columns already exist from migration 003.)
alter table public.profiles add column if not exists test_optional boolean;
alter table public.profiles add column if not exists hs jsonb;
