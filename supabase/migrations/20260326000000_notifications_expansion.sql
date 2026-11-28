-- Notifications expansion: new_listing fan-out, new_follower daily agg, review daily agg.
-- Paste in the Supabase SQL editor after follows (20260325000000).
-- shortcut: exception inside notify triggers → WARNING, RETURN NEW — never roll back publish/follow/review.
-- shortcut: payout type deferred — no payout.paid|failed webhook surface yet; add when those events are locked.
-- shortcut: aggregate actor count is soft-overcount (bump on every insert); upgrade with meta jsonb if exact unique actors are needed.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'purchase', 'sale', 'refund', 'report', 'verification',
    'new_follower', 'new_listing', 'review'
  ));

-- 1. new_listing — fan-out to followers on publish
create or replace function public.notify_new_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_href text;
  v_body text;
begin
  if new.status is distinct from 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'published' then
    return new;
  end if;

  begin
    if new.slug is null or new.slug = '' or position('://' in new.slug) > 0 then
      return new;
    end if;

    select c.user_id into v_owner
    from public.creators c
    where c.id = new.creator_id;

    v_href := '/datacuts/' || new.slug;
    v_body := left(coalesce(new.title, ''), 240);

    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    select
      f.user_id,
      'new_listing',
      'New listing',
      v_body,
      v_href,
      'new_listing:' || new.id::text
    from public.follows f
    where f.creator_id = new.creator_id
      and (v_owner is null or f.user_id is distinct from v_owner)
    on conflict (user_id, dedupe_key) do nothing;
  exception
    when others then
      raise warning 'notify_new_listing %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_new_listing on public.datacuts;
create trigger notifications_new_listing
  after insert or update of status on public.datacuts
  for each row execute function public.notify_new_listing();

-- 2. new_follower — daily aggregate upsert (replaces per-pair key)
create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_name text := '';
  v_dedupe text;
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
    select coalesce(nullif(trim(display_name), ''), 'Someone') into v_name
    from public.profiles
    where id = new.user_id;
  exception
    when others then
      v_name := 'Someone';
  end;
  if v_name is null or v_name = '' then
    v_name := 'Someone';
  end if;

  v_dedupe := 'new_follower:agg:' || to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'new_follower',
      'New follower',
      left(v_name, 240),
      '/dashboard',
      v_dedupe
    )
    on conflict (user_id, dedupe_key) do update
    set
      body = left(
        case
          when notifications.body ~ ' and [0-9]+ others$' then
            regexp_replace(
              notifications.body,
              ' and ([0-9]+) others$',
              ' and ' || ((regexp_match(notifications.body, ' and ([0-9]+) others$'))[1]::int + 1)::text || ' others'
            )
          else
            notifications.body || ' and 1 others'
        end,
        240
      ),
      created_at = now()
    where notifications.read_at is null;
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

-- 3. review — visible insert only; daily aggregate for the listing owner
create or replace function public.notify_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_slug text;
  v_cut_title text;
  v_snippet text;
  v_href text;
  v_dedupe text;
begin
  if tg_op = 'INSERT' and new.visible is not true then
    return new;
  end if;
  -- v1: no second ping on restore (visible false → true); INSERT-only path
  if tg_op <> 'INSERT' then
    return new;
  end if;

  begin
    select c.user_id, d.slug, d.title
      into v_owner, v_slug, v_cut_title
    from public.datacuts d
    join public.creators c on c.id = d.creator_id
    where d.id = new.datacut_id;
  exception
    when others then
      raise warning 'notify_review lookup %: %', new.id, sqlerrm;
      return new;
  end;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  if v_slug is null or v_slug = '' or position('://' in v_slug) > 0 then
    return new;
  end if;

  v_href := '/datacuts/' || v_slug;
  v_snippet := new.rating::text || '★';
  if new.body is not null and trim(new.body) <> '' then
    v_snippet := v_snippet || ' ' || left(trim(new.body), 200);
  elsif v_cut_title is not null and v_cut_title <> '' then
    v_snippet := v_snippet || ' ' || left(v_cut_title, 200);
  end if;
  v_snippet := left(v_snippet, 240);

  v_dedupe := 'review:agg:' || to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'review',
      'New review',
      v_snippet,
      v_href,
      v_dedupe
    )
    on conflict (user_id, dedupe_key) do update
    set
      body = left(
        case
          when notifications.body ~ ' and [0-9]+ others$' then
            regexp_replace(
              notifications.body,
              ' and ([0-9]+) others$',
              ' and ' || ((regexp_match(notifications.body, ' and ([0-9]+) others$'))[1]::int + 1)::text || ' others'
            )
          else
            notifications.body || ' and 1 others'
        end,
        240
      ),
      href = excluded.href,
      created_at = now()
    where notifications.read_at is null;
  exception
    when others then
      raise warning 'notify_review %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_review on public.reviews;
create trigger notifications_review
  after insert on public.reviews
  for each row execute function public.notify_review();
