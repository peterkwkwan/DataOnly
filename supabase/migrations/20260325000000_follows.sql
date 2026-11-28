-- Creator follows + new_follower bell.
-- Paste once in the Supabase SQL editor on a live DB that already has notifications (sale/purchase types).
-- Idempotent: safe to re-run. Widens notifications_type_check (incl. new_follower) before the notify trigger.
-- After this, optional: 20260326000000_notifications_expansion.sql then 20260327000000+ save/sale link migrations.
-- shortcut: creators.followers stays text for the existing mapper; switch to integer only if a later feature needs numeric sort on the column.
-- shortcut: exception inside the new_follower trigger → WARNING, RETURN NEW — a notify failure must not roll back the follow insert.

create table if not exists public.follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  creator_id text not null references public.creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

create index if not exists follows_creator_idx on public.follows (creator_id);
create index if not exists follows_user_idx on public.follows (user_id);

create or replace function public.prevent_self_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from public.creators
  where id = new.creator_id;

  if v_owner is not null and v_owner = new.user_id then
    raise exception 'cannot follow your own storefront';
  end if;

  return new;
end;
$$;

drop trigger if exists follows_prevent_self on public.follows;
create trigger follows_prevent_self
  before insert on public.follows
  for each row execute function public.prevent_self_follow();

create or replace function public.refresh_creator_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid text;
begin
  cid := coalesce(new.creator_id, old.creator_id);
  update public.creators
  set followers = (
    select count(*)::text from public.follows where creator_id = cid
  ),
  updated_at = now()
  where id = cid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists follows_follower_count on public.follows;
create trigger follows_follower_count
  after insert or delete on public.follows
  for each row execute function public.refresh_creator_follower_count();

-- Widen before notify_new_follower. Drop every type allow-list check (name/def can
-- drift; pg often stores IN as ANY(ARRAY[...])), then re-add the full tip list.
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* '(type\s+in\s*\(|type\s*=\s*any\s*\()'
  loop
    execute format('alter table public.notifications drop constraint %I', cname);
  end loop;
end $$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications drop constraint if exists notifications_type_check1;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'purchase', 'sale', 'refund', 'report', 'verification',
    'new_follower', 'new_listing', 'review', 'save'
  ));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_type_check'
      and pg_get_constraintdef(oid) like '%new_follower%'
  ) then
    raise exception 'notifications_type_check missing new_follower';
  end if;
end $$;

create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_body text := '';
  v_name text;
begin
  begin
    select c.user_id into v_owner
    from public.creators c
    where c.id = new.creator_id;
  exception
    when others then
      raise warning 'notify_new_follower lookup %: %', new.creator_id, sqlerrm;
      return new;
  end;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  begin
    select display_name into v_name
    from public.profiles
    where id = new.user_id;
    if v_name is not null and v_name <> '' then
      v_body := left(v_name, 240);
    end if;
  exception
    when others then
      v_body := '';
  end;

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'new_follower',
      'New follower',
      v_body,
      '/dashboard',
      'new_follower:' || new.user_id::text || ':' || new.creator_id
    )
    on conflict (user_id, dedupe_key) do nothing;
  exception
    when others then
      raise warning 'notify_new_follower %: %', new.creator_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_new_follower on public.follows;
create trigger notifications_new_follower
  after insert on public.follows
  for each row execute function public.notify_new_follower();

alter table public.follows enable row level security;

drop policy if exists follows_owner_select on public.follows;
create policy follows_owner_select on public.follows
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists follows_owner_insert on public.follows;
create policy follows_owner_insert on public.follows
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists follows_owner_delete on public.follows;
create policy follows_owner_delete on public.follows
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.follows from public, anon, authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, delete on public.follows to service_role;
