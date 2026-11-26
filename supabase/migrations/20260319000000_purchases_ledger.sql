create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  datacut_id bigint not null references public.datacuts (id) on delete restrict,
  license text not null check (license in ('personal', 'commercial')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'paid'
    check (status in ('paid', 'refunded')),
  refund_requested_at timestamptz,
  refund_request_note text,
  created_at timestamptz not null default now(),
  constraint purchases_refund_request_note_len check (
    refund_request_note is null
    or char_length(refund_request_note) <= 500
  )
);

create index if not exists purchases_user_created_idx
  on public.purchases (user_id, created_at desc);
create index if not exists purchases_datacut_idx
  on public.purchases (datacut_id);
create index if not exists purchases_payment_intent_idx
  on public.purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.purchases enable row level security;

drop policy if exists "purchases_select_own" on public.purchases;
create policy "purchases_select_own" on public.purchases
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "purchases_admin_all" on public.purchases;
create policy "purchases_admin_all" on public.purchases
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.purchases to authenticated;
grant select, insert, update, delete on public.purchases to service_role;

comment on table public.purchases is
  'One row per Checkout. History and refund requests. Access stays on entitlements.';

-- One receipt for each entitlement that exists today. Charges already
-- overwritten by a later upsert cannot be rebuilt.
insert into public.purchases (
  user_id, datacut_id, license, amount_cents, currency,
  stripe_checkout_session_id, stripe_payment_intent_id, status, created_at
)
select
  user_id,
  datacut_id,
  license,
  amount_cents,
  currency,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  case when status = 'refunded' then 'refunded' else 'paid' end,
  created_at
from public.entitlements
on conflict (stripe_checkout_session_id) do nothing;
