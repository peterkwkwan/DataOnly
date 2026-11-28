-- Purchaser reviews / ratings. Paste in the Supabase SQL editor after datacut_sample.
-- Active entitlement gates buyer writes. Refund/revoke hide via service-role path.
-- Denormalized datacuts.rating / datacuts.reviews stay the public aggregates.

create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  datacut_id bigint not null references public.datacuts (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, datacut_id),
  constraint reviews_body_len check (
    body is null or char_length(body) <= 500
  )
);

create index if not exists reviews_datacut_visible_created_idx
  on public.reviews (datacut_id, created_at desc)
  where visible = true;

alter table public.reviews enable row level security;

-- Public list: visible only. Owner + admin see own/all (including hidden).
drop policy if exists "reviews_select_visible_own_or_admin" on public.reviews;
create policy "reviews_select_visible_own_or_admin" on public.reviews
  for select to anon, authenticated
  using (
    visible = true
    or user_id = auth.uid()
    or public.is_admin()
  );

-- Buyer insert only while entitlement is active for that cut.
drop policy if exists "reviews_insert_active_entitled" on public.reviews;
create policy "reviews_insert_active_entitled" on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.entitlements e
      where e.user_id = auth.uid()
        and e.datacut_id = reviews.datacut_id
        and e.status = 'active'
    )
  );

-- Buyer update (rating/body/visible) only while active. Admin can update any.
drop policy if exists "reviews_update_active_or_admin" on public.reviews;
create policy "reviews_update_active_or_admin" on public.reviews
  for update to authenticated
  using (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.entitlements e
        where e.user_id = auth.uid()
          and e.datacut_id = reviews.datacut_id
          and e.status = 'active'
      )
    )
  )
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.entitlements e
        where e.user_id = auth.uid()
          and e.datacut_id = reviews.datacut_id
          and e.status = 'active'
      )
    )
  );

revoke all on table public.reviews from public, anon, authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert, update on table public.reviews to authenticated;
grant select, insert, update, delete on table public.reviews to service_role;

comment on table public.reviews is
  'One purchaser rating per (user, datacut). Write gate is active entitlement; refund/admin hide sets visible=false.';

-- Keep datacuts.rating / reviews in sync with visible rows.
create or replace function public.reviews_refresh_datacut_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_datacut_id bigint;
  v_count integer;
  v_avg numeric;
begin
  v_datacut_id := coalesce(new.datacut_id, old.datacut_id);
  if v_datacut_id is null then
    return coalesce(new, old);
  end if;

  select count(*)::integer,
         coalesce(round(avg(rating)::numeric, 2), 0)
    into v_count, v_avg
  from public.reviews
  where datacut_id = v_datacut_id
    and visible = true;

  update public.datacuts
  set rating = v_avg,
      reviews = v_count
  where id = v_datacut_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_refresh_aggregates on public.reviews;
create trigger reviews_refresh_aggregates
  after insert or update or delete on public.reviews
  for each row
  execute function public.reviews_refresh_datacut_aggregates();
