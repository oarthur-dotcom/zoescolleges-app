-- M23: parents can delete any family photo; everyone can still delete their own.
drop policy if exists "remove own photo" on public.photos;
drop policy if exists "remove own or parent photo" on public.photos;
create policy "remove own or parent photo" on public.photos for delete
  using (family_id = public.my_family_id() and (
    user_id = auth.uid()
    or exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'parent')));
