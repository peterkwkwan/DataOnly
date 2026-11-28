-- Save notify: body includes datacut title; href → listing stats (not public storefront).
-- Paste after notify_save (20260327000000). create or replace only — type check already widened.
-- shortcut: exception inside notify trigger → WARNING, RETURN NEW — never roll back a save insert.
-- shortcut: aggregate actor count is soft-overcount (bump on every insert); upgrade with meta jsonb if exact unique actors are needed.

create or replace function public.notify_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text := '';
  v_name text := '';
  v_body text;
  v_href text;
  v_dedupe text;
begin
  begin
    select c.user_id, coalesce(d.title, '')
      into v_owner, v_title
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

  -- Match review/sale: muted body line carries the cut title; keeper name first like new_follower.
  if v_title is not null and trim(v_title) <> '' then
    v_body := left(v_name || ' · ' || trim(v_title), 240);
  else
    v_body := left(v_name, 240);
  end if;

  v_href := '/dashboard/listings/' || new.datacut_id::text || '/stats';
  v_dedupe := 'save:agg:' || to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');

  begin
    insert into public.notifications (user_id, type, title, body, href, dedupe_key)
    values (
      v_owner,
      'save',
      'New save',
      v_body,
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
