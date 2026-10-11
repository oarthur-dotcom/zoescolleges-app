-- Migration 013: let each person see (and so turn off) the share links THEY created (#56, Oct 11).
-- POLICY ONLY. No tables or rows change. Run AFTER migration 012.
-- Why: Postgres only deletes rows the person can also read. Migration 004 deliberately had no read policy,
-- so "Turn off" couldn't find the row. This adds a read policy limited to the creator's own links —
-- nobody can list anyone else's links, and visitors still read one link only by its exact token (get_share).
drop policy if exists "owner reads own shares" on public.shares;
create policy "owner reads own shares" on public.shares
  for select using (created_by = auth.uid());
