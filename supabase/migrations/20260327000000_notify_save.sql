-- Save → creator notification (daily aggregate). Paste after notifications expansion (20260326000000).
-- shortcut: exception inside notify trigger → WARNING, RETURN NEW — never roll back a save insert.
-- shortcut: aggregate actor count is soft-overcount (bump on every insert); upgrade with meta jsonb if exact unique actors are needed.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'purchase', 'sale', 'refund', 'report', 'verification',
    'new_follower', 'new_listing', 'review', 'save'
  ));

-- save — daily aggregate for the listing owner; skip self-saves
create or replace function public.notify_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_slug text;
  v_name text := '';
  v_href text;
  v_dedupe text;
begin
  begin
    select c.user_id, d.slug
      into v_owner, v_slug
    from public.datacuts d
    join public.creators c on c.id = d.creator_id
    where d.id = new.datacut_id;
  exception
    when others then
      raise warning 'notify_save lookup %: %', new.datacut_id, sqlerrm;
      return new;
  end;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  if v_slug is null or v_slug = '' or position('://' in v_slug) > 0 then
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

  v_href := '/datacuts/' || v_slug;
  v_dedupe := 'save:agg:' || to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'save',
      'New save',
      left(v_name, 240),
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
      raise warning 'notify_save %: %', new.datacut_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_save on public.saved;
create trigger notifications_save
  after insert on public.saved
  for each row execute function public.notify_save();
