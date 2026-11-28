-- Optional creator-supplied sample/preview file (public download without purchase).

alter table public.datacuts
  add column if not exists sample_storage_path text,
  add column if not exists sample_file_name text;

comment on column public.datacuts.sample_storage_path is
  'Object path for the optional sample file inside the private datacuts bucket (e.g. {creator_id}/{datacut_id}/sample/{file}). Null = no sample.';
comment on column public.datacuts.sample_file_name is
  'Original filename for the sample download.';
