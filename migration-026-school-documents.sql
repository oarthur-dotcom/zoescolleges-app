-- Zoe's Colleges M26: private documents (essays, recommendations, transcript, scores) kept per school, versioned.
-- ADDITIVE and non-destructive: one new table, one new PRIVATE storage bucket, policies. Nothing existing is changed.
-- NOT YET RUN. Take a manual Supabase export first (standing rule). Until it runs, the app shows
-- "Document storage switches on after the next database update" and everything else works as before.

create table if not exists public.school_docs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  school_id text not null,
  task_key text not null check (task_key in ('Essays','Recommendations','Transcript','Test scores')),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) <= 120),
  path text not null,
  mime text,
  size integer check (size is null or size <= 10485760),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_by uuid
);
create index if not exists school_docs_family_school on public.school_docs (family_id, school_id);
alter table public.school_docs enable row level security;

drop policy if exists "family reads school docs" on public.school_docs;
create policy "family reads school docs" on public.school_docs for select using (family_id = public.my_family_id());
drop policy if exists "family adds school docs" on public.school_docs;
create policy "family adds school docs" on public.school_docs for insert with check (family_id = public.my_family_id() and user_id = auth.uid());
-- anyone in the family can mark a version submitted / undo it
drop policy if exists "family marks school docs" on public.school_docs;
create policy "family marks school docs" on public.school_docs for update using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
-- the uploader, or a parent, can delete
drop policy if exists "remove own or parent school doc" on public.school_docs;
create policy "remove own or parent school doc" on public.school_docs for delete using (family_id = public.my_family_id() and (
  user_id = auth.uid() or exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'parent')));

-- PRIVATE bucket (never public), 10 MB per file, Word and PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-docs','school-docs', false, 10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists "school-docs family read" on storage.objects;
create policy "school-docs family read" on storage.objects for select to authenticated
  using (bucket_id = 'school-docs' and (storage.foldername(name))[1] = public.my_family_id()::text);
drop policy if exists "school-docs family upload" on storage.objects;
create policy "school-docs family upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'school-docs' and (storage.foldername(name))[1] = public.my_family_id()::text);
drop policy if exists "school-docs family delete" on storage.objects;
create policy "school-docs family delete" on storage.objects for delete to authenticated
  using (bucket_id = 'school-docs' and (storage.foldername(name))[1] = public.my_family_id()::text);

-- Rollback (removes the feature; deletes only what this migration created):
--   drop table public.school_docs;  delete from storage.buckets where id = 'school-docs';  (empty the bucket first in the dashboard)
