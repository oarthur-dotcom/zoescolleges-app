-- Migration 009: family photos visible only to that family (audit Oct 11, #13).
-- POLICIES ONLY — no photos or rows are changed or deleted.
-- Run AFTER the page from fix #15 is live (it uses signed links, which work either way).
-- Then, in Supabase -> Storage -> campus-photos -> Edit bucket, turn OFF "Public bucket".
-- (Leaving the toggle for the dashboard keeps this file free of data-changing statements.)

drop policy if exists "campus-photos public read" on storage.objects;
drop policy if exists "campus-photos family read" on storage.objects;
create policy "campus-photos family read" on storage.objects
  for select to authenticated
  using (bucket_id = 'campus-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);

-- Rollback (restores the old behaviour):
--   drop policy "campus-photos family read" on storage.objects;
--   create policy "campus-photos public read" on storage.objects for select using (bucket_id = 'campus-photos');
--   and turn "Public bucket" back ON.
