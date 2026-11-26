-- Notifications bell. Paste in the Supabase SQL editor after the purchases ledger.
-- No backfill: existing sales, refunds, and reviews stay out of the bell.
-- shortcut: an exception in a trigger is a WARNING then RETURN NEW, so a bell failure must not roll back checkout, a refund, or an admin action.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('purchase', 'sale', 'refund', 'report', 'verification')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 240),
  href text not null check (href like '/%' and href not like '%://%'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text not null,
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.notifications from public, anon, authenticated;
grant select, update (read_at) on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

-- shortcut: a hold row is written only when an unpublished datacut or a hidden creator was updated within 1 minute of this report row, because the admin page writes those rows first. A creator who is already hidden can make Force unpublish read as Storefront hidden (the cut-count trigger bumps creators.updated_at). Upgrade when the admin action records which button ran.

create or replace function public.notify_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut_title text;
  v_slug text;
  v_owner uuid;
  v_body text;
begin
  begin
    select d.title, d.slug, c.user_id
      into v_cut_title, v_slug, v_owner
    from public.datacuts d
    join public.creators c on c.id = d.creator_id
    where d.id = new.datacut_id;
  exception
    when others then
      raise warning 'notify_purchase lookup %: %', new.id, sqlerrm;
      return new;
  end;

  v_body := left(coalesce(v_cut_title, ''), 240);

  if tg_op = 'INSERT' then
    if new.status = 'paid' then
      if v_slug is not null and v_slug <> '' and position('://' in v_slug) = 0 then
        begin
          insert into public.notifications (user_id, type, title, body, href, dedupe_key)
          values (
            new.user_id,
            'purchase',
            'Purchase confirmed',
            v_body,
            '/datacuts/' || v_slug,
            'purchase:' || new.id::text
          )
          on conflict (user_id, dedupe_key) do nothing;
        exception
          when others then
            raise warning 'notify_purchase buyer %: %', new.id, sqlerrm;
        end;
      end if;

      if v_owner is not null and v_owner is distinct from new.user_id then
        begin
          insert into public.notifications (user_id, type, title, body, href, dedupe_key)
          values (
            v_owner,
            'sale',
            'New sale',
            v_body,
            '/dashboard?tab=listings',
            'sale:' || new.id::text
          )
          on conflict (user_id, dedupe_key) do nothing;
        exception
          when others then
            raise warning 'notify_purchase seller %: %', new.id, sqlerrm;
        end;
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'refunded' and old.status is distinct from new.status then
      begin
        insert into public.notifications (user_id, type, title, body, href, dedupe_key)
        values (
          new.user_id,
          'refund',
          'Purchase refunded',
          v_body,
          '/account?tab=purchases',
          'refund:' || new.id::text || ':buyer'
        )
        on conflict (user_id, dedupe_key) do nothing;
      exception
        when others then
          raise warning 'notify_purchase refund buyer %: %', new.id, sqlerrm;
      end;

      if v_owner is not null then
        begin
          insert into public.notifications (user_id, type, title, body, href, dedupe_key)
          values (
            v_owner,
            'refund',
            'Sale refunded',
            v_body,
            '/dashboard?tab=listings',
            'refund:' || new.id::text || ':creator'
          )
          on conflict (user_id, dedupe_key) do nothing;
        exception
          when others then
            raise warning 'notify_purchase refund creator %: %', new.id, sqlerrm;
        end;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_purchase on public.purchases;
create trigger notifications_purchase
  after insert or update of status on public.purchases
  for each row execute function public.notify_purchase();

create or replace function public.notify_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
  v_body text := '';
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('approved', 'needs_more_info', 'rejected') then
    return new;
  end if;

  begin
    select user_id into v_owner
    from public.creators
    where id = new.creator_id;
  exception
    when others then
      raise warning 'notify_verification lookup %: %', new.id, sqlerrm;
      return new;
  end;

  if v_owner is null then
    return new;
  end if;

  v_title := case new.status
    when 'approved' then 'Verification approved'
    when 'needs_more_info' then 'Verification needs info'
    else 'Verification not approved'
  end;

  if new.status = 'needs_more_info' then
    v_body := left(coalesce(new.info_request_note, ''), 240);
  elsif new.status = 'rejected' then
    v_body := left(coalesce(new.rejection_reason, ''), 240);
  end if;

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'verification',
      v_title,
      v_body,
      '/account',
      'verification:' || new.id::text || ':' || new.status
    )
    on conflict (user_id, dedupe_key) do nothing;
  exception
    when others then
      raise warning 'notify_verification %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_verification on public.verification_applications;
create trigger notifications_verification
  after update of status on public.verification_applications
  for each row execute function public.notify_verification();

create or replace function public.notify_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_body text := '';
  v_title text;
  v_hidden boolean := false;
  v_creator_at timestamptz;
  v_cut_status text;
  v_cut_at timestamptz;
  v_cut_fresh boolean := false;
  v_hide_fresh boolean := false;
  v_dedupe text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('under_review', 'removed') then
    return new;
  end if;

  if new.datacut_id is not null then
    begin
      select c.user_id, left(coalesce(d.title, ''), 240), d.status, d.updated_at, c.hidden, c.updated_at
        into v_owner, v_body, v_cut_status, v_cut_at, v_hidden, v_creator_at
      from public.datacuts d
      join public.creators c on c.id = d.creator_id
      where d.id = new.datacut_id;
    exception
      when others then
        raise warning 'notify_report lookup %: %', new.id, sqlerrm;
        return new;
    end;

    v_cut_fresh := v_cut_status = 'unpublished'
      and v_cut_at is not null
      and v_cut_at >= new.updated_at - interval '1 minute'
      and v_cut_at <= new.updated_at + interval '1 minute';
  elsif new.creator_id is not null then
    begin
      select c.user_id, c.hidden, c.updated_at
        into v_owner, v_hidden, v_creator_at
      from public.creators c
      where c.id = new.creator_id;

      select exists (
        select 1
        from public.datacuts d
        where d.creator_id = new.creator_id
          and d.status = 'unpublished'
          and d.updated_at >= new.updated_at - interval '1 minute'
          and d.updated_at <= new.updated_at + interval '1 minute'
      ) into v_cut_fresh;
    exception
      when others then
        raise warning 'notify_report lookup %: %', new.id, sqlerrm;
        return new;
    end;
  end if;

  v_hide_fresh := coalesce(v_hidden, false)
    and v_creator_at is not null
    and v_creator_at >= new.updated_at - interval '1 minute'
    and v_creator_at <= new.updated_at + interval '1 minute';

  if new.status = 'removed' then
    v_title := 'Listing removed';
    v_dedupe := 'report:' || new.id::text || ':removed';
  elsif v_hide_fresh then
    v_title := 'Storefront hidden';
    v_dedupe := 'report:' || new.id::text || ':held';
  elsif v_cut_fresh then
    v_title := 'Listing unpublished';
    v_dedupe := 'report:' || new.id::text || ':held';
  else
    return new;
  end if;

  if v_owner is null then
    return new;
  end if;

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'report',
      v_title,
      coalesce(v_body, ''),
      '/dashboard?tab=listings',
      v_dedupe
    )
    on conflict (user_id, dedupe_key) do nothing;
  exception
    when others then
      raise warning 'notify_report %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_report on public.reports;
create trigger notifications_report
  after update of status on public.reports
  for each row execute function public.notify_report();
