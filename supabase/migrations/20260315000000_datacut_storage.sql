-- Datacut file delivery: private Storage bucket + path columns on listings

alter table public.datacuts
  add column if not exists storage_path text,
  add column if not exists file_name text;

comment on column public.datacuts.storage_path is
  'Object path inside the private datacuts Storage bucket (e.g. {creator_id}/{datacut_id}/{file}). Null until a file is uploaded.';
comment on column public.datacuts.file_name is
  'Original download filename shown to entitled buyers.';

-- Private bucket: no public/anon reads. Buyers get short-lived signed URLs from
-- /api/entitlements/access (service role) after an active entitlement check.
insert into storage.buckets (id, name, public, file_size_limit)
values ('datacuts', 'datacuts', false, 524288000) -- 500 MiB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Drop prior policies if re-running
drop policy if exists "datacuts_objects_owner_select" on storage.objects;
drop policy if exists "datacuts_objects_owner_insert" on storage.objects;
drop policy if exists "datacuts_objects_owner_update" on storage.objects;
drop policy if exists "datacuts_objects_owner_delete" on storage.objects;
drop policy if exists "datacuts_objects_admin_all" on storage.objects;

-- Path convention: {creator_id}/{datacut_id}/{filename}
-- First folder segment must match a creators.id the uploader owns.
create policy "datacuts_objects_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'datacuts'
    and (
      public.is_admin()
      or public.owns_creator((storage.foldername(name))[1])
    )
  );

create policy "datacuts_objects_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'datacuts'
    and (
      public.is_admin()
      or public.owns_creator((storage.foldername(name))[1])
    )
  );

create policy "datacuts_objects_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'datacuts'
    and (
      public.is_admin()
      or public.owns_creator((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'datacuts'
    and (
      public.is_admin()
      or public.owns_creator((storage.foldername(name))[1])
    )
  );

create policy "datacuts_objects_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'datacuts'
    and (
      public.is_admin()
      or public.owns_creator((storage.foldername(name))[1])
    )
  );

-- Explicit admin catch-all (covers service_role bypass anyway; keeps dashboard ops clear)
create policy "datacuts_objects_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'datacuts' and public.is_admin())
  with check (bucket_id = 'datacuts' and public.is_admin());
