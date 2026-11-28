-- Beta: report / takedown queue + force-unpublish while investigating

-- Allow moderation unpublish (separate from creator draft)
alter table public.datacuts
  drop constraint if exists datacuts_status_check;

alter table public.datacuts
  add constraint datacuts_status_check
  check (status in ('draft', 'published', 'unpublished'));

-- Hide creator storefront from public catalog while investigating
alter table public.creators
  add column if not exists hidden boolean not null default false;

create index if not exists creators_hidden_idx on public.creators (hidden)
  where hidden = true;

-- Reports: buyer + visitor can file; admin reviews
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('datacut', 'creator')),
  datacut_id bigint references public.datacuts (id) on delete set null,
  creator_id text references public.creators (id) on delete set null,
  reason text not null check (reason in ('copyright', 'privacy', 'prohibited', 'spam', 'other')),
  details text not null default '',
  status text not null default 'open'
    check (status in ('open', 'under_review', 'removed', 'no_action', 'escalate')),
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_email text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  outcome_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_target_present check (
    (target_type = 'datacut' and datacut_id is not null)
    or (target_type = 'creator' and creator_id is not null)
  )
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_datacut_idx on public.reports (datacut_id)
  where datacut_id is not null;
create index if not exists reports_creator_idx on public.reports (creator_id)
  where creator_id is not null;

alter table public.reports enable row level security;

-- Anyone (anon visitor or signed-in buyer) may file a report
drop policy if exists "reports_insert_public" on public.reports;
create policy "reports_insert_public" on public.reports
  for insert
  with check (
    reporter_id is null
    or reporter_id = auth.uid()
  );

-- Reporters see their own; admins see all
drop policy if exists "reports_select_own_or_admin" on public.reports;
create policy "reports_select_own_or_admin" on public.reports
  for select using (
    public.is_admin()
    or (reporter_id is not null and reporter_id = auth.uid())
  );

-- Only admins update / delete (queue actions + audit fields)
drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reports_admin_delete" on public.reports;
create policy "reports_admin_delete" on public.reports
  for delete using (public.is_admin());

grant select, insert on public.reports to anon, authenticated;
grant update, delete on public.reports to authenticated;

-- Hidden creators: directory/storefront hide in app; owner + admin always see.
-- Published-cut attribution stays readable so embeds / id lookups are not "Unknown creator".
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
