-- Sale notify: href → listing stats (same pattern as save notify).
-- Paste after notify_save_listing_copy (20260328000000). create or replace notify_purchase only.
-- shortcut: exception inside notify trigger → WARNING, RETURN NEW — never roll back checkout or refund.

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
            '/dashboard/listings/' || new.datacut_id::text || '/stats',
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
