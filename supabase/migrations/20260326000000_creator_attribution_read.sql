-- Published-cut attribution: buyers/visitors must see creator name/verified even when
-- the storefront is hidden (takedown). Directory/storefront still filter hidden in app.
-- Safe to re-run.

drop policy if exists "creators_public_read" on public.creators;
create policy "creators_public_read" on public.creators
  for select using (
    hidden = false
    or user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.datacuts d
      where d.creator_id = creators.id
        and d.status = 'published'
    )
  );
