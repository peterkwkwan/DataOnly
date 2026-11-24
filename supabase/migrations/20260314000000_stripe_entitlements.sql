-- Beta: Stripe Connect + entitlements (purchase → access gate)

-- Buyer Stripe Customer id (optional cache; Checkout can create customers on the fly)
alter table public.profiles
  add column if not exists stripe_customer_id text;

-- Creator Express Connect account (MVP)
alter table public.creators
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarding_complete boolean not null default false;

create unique index if not exists creators_stripe_account_id_uidx
  on public.creators (stripe_account_id)
  where stripe_account_id is not null;

create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Entitlement after successful Checkout (license version pinned at purchase)
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  datacut_id bigint not null references public.datacuts (id) on delete restrict,
  license text not null check (license in ('personal', 'commercial')),
  license_version text not null default 'v1',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_account_id text,
  status text not null default 'active'
    check (status in ('pending', 'active', 'refunded', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, datacut_id)
);

create index if not exists entitlements_user_idx on public.entitlements (user_id);
create index if not exists entitlements_datacut_idx on public.entitlements (datacut_id);
create index if not exists entitlements_status_idx on public.entitlements (status);

alter table public.entitlements enable row level security;

-- Buyers read their own entitlements; writers are service_role (webhook) / admin
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "entitlements_admin_all" on public.entitlements;
create policy "entitlements_admin_all" on public.entitlements
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.entitlements to authenticated;
grant select, insert, update, delete on public.entitlements to service_role;

-- Creators may update their own Connect status fields via API using user session
-- (stripe_account_id is set by server routes with the user client after Express create)
