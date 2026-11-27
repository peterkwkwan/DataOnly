-- Listing page views for creator stats. Paste in the Supabase SQL editor after notifications.
-- Anyone may insert a view for a published datacut; only service_role reads rows.

create extension if not exists pgcrypto;

create table if not exists public.listing_page_views (
  id uuid primary key default gen_random_uuid(),
  datacut_id bigint not null references public.datacuts (id) on delete cascade,
  visitor_key text,
  created_at timestamptz not null default now()
);

create index if not exists listing_page_views_datacut_created_idx
  on public.listing_page_views (datacut_id, created_at);

alter table public.listing_page_views enable row level security;

drop policy if exists "listing_page_views_insert_published" on public.listing_page_views;
create policy "listing_page_views_insert_published" on public.listing_page_views
  for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.datacuts d
      where d.id = datacut_id
        and d.status = 'published'
    )
  );

revoke all on table public.listing_page_views from public, anon, authenticated;
grant insert on table public.listing_page_views to anon, authenticated;
grant select, insert, update, delete on table public.listing_page_views to service_role;

comment on table public.listing_page_views is
  'Thin page-view events for listing stats. Creators never select raw rows; aggregates via service role.';
