# DataOnly

Marketplace for expert-curated **datacuts**. Phase 1 mock catalog still runs with no backend. **Alpha** adds optional Supabase auth, listings, saved lists, and verification. **Beta** adds Stripe Connect checkout + entitlements (this slice).

Visual source: [Figma Make — DataOnly](https://www.figma.com/make/LmfXZLjhEh2TWVN9zgD9to/DataOnly).

## Monorepo

| Path | Stack |
|------|--------|
| `apps/web` | Next.js App Router (TypeScript) — SEO portal + creator/admin |
| `apps/mobile` | Expo + Expo Router (TypeScript) — iOS/Android (mock catalog; Supabase env stub) |
| `packages/core` | Shared types, mock catalog, Supabase client helpers |
| `supabase/` | SQL migrations + seed from mock data |

Package manager: **npm** workspaces.

## Prerequisites

- Node.js 20+ (22 recommended)
- npm 10+ (comes with Node)
- For mobile: Expo Go on a device, or iOS Simulator / Android emulator
- For Alpha/Beta live data: a Supabase project (see below)
- For live purchases: a Stripe account with Connect (see Beta section)

```bash
npm install
```

## Run web (mock by default)

```bash
npm run dev:web
# → http://localhost:3000
```

With **no** Supabase env vars, the app uses `packages/core` mock data (same as Phase 1).

Routes: `/` Home · `/explore` · `/creators` · `/datacuts/[slug]` · `/saved` · `/search` · `/auth/sign-in` · `/dashboard` · `/dashboard/tos` · `/admin/verification`

## Run mobile

```bash
npm run dev:mobile
```

Same mock catalog via `@dataonly/core`. Expo env stubs: see `apps/mobile/.env.example`.

## Supabase setup (Alpha)

Do this in the [Supabase dashboard](https://supabase.com/dashboard) — this repo does **not** ship secret values.

1. **Create a project** and wait for it to finish provisioning.
2. **SQL Editor** — run in order:
   - `supabase/migrations/20260311000000_init.sql` (tables, triggers)
   - `supabase/migrations/20260311000001_rls.sql` (RLS policies + table GRANTs)
   - `supabase/migrations/20260311000002_grants.sql` (idempotent GRANTs; required if you ran an older rls without privileges)
   - `supabase/migrations/20260312000000_verification_sources.sql` (adds `sources jsonb` if you already ran init before this column existed)
   - `supabase/migrations/20260313000000_creator_tos.sql` (adds `profiles.tos_accepted_at` + `profiles.tos_version` for Creator ToS acceptance)
   - `supabase/migrations/20260314000000_stripe_entitlements.sql` (Stripe Connect fields + `entitlements` table)
   - `supabase/seed.sql` (categories / creators / datacuts from mock)

   **Already ran init + rls once?** Paste this in SQL Editor (same as `20260311000002_grants.sql`) — do not re-run full init:

```sql
grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.creators to anon, authenticated;
grant insert, update on public.creators to authenticated;

grant select on public.datacuts to anon, authenticated;
grant insert, update, delete on public.datacuts to authenticated;
grant usage, select on sequence public.datacuts_id_seq to anon, authenticated;

grant select, insert, update, delete on public.saved to authenticated;

grant select, insert, update, delete on public.verification_applications to authenticated;
```
3. **Authentication → Providers** — enable Email (magic link and/or password). Optionally enable **Google** (paste Client ID + Client Secret from Google Cloud). No SMTP required for Google OAuth.
4. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000` (or your production origin)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR_HOST/auth/callback`
5. **Google Cloud Console** (for “Continue with Google” on `/auth/sign-in`)
   - APIs & Services → Credentials → Create **OAuth client ID** (Web application)
   - Authorized JavaScript origins: `http://localhost:3000`, `https://YOUR_HOST`
   - Authorized redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID + Client Secret into Supabase → Authentication → Providers → Google
6. **Project Settings → API** — copy:
   - Project URL
   - Publishable key (legacy UI label: `anon` `public`)
   - Service role key (server-only — needed for Stripe webhook entitlement writes)
   Do **not** put the `service_role` key in Next.js public env.
7. Create `apps/web/.env.local` from `apps/web/.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

8. Restart `npm run dev:web`. Public catalog pages read published rows from Supabase; if env is missing or queries fail, they fall back to mock.
9. Sign in at `/auth/sign-in` (Google, magic link, or email + password), open `/dashboard` (creates your creator profile), then promote yourself for the admin queue:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

10. Optional Expo stub (`apps/mobile/.env`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Helper reminder script (prints the same steps):

```bash
npm run seed:help
```

### Env vars Peter must set

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/web/.env.local` | Public publishable key (safe for browser with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/web/.env.local` (server-only) | Webhook writes to `entitlements` (bypass RLS) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `apps/web/.env.local` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | `apps/web/.env.local` (server-only) | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `apps/web/.env.local` (server-only) | Webhook signing secret (`whsec_…`) |
| `STRIPE_PLATFORM_FEE_PERCENT` | optional, default `10` | Platform fee % of listing price |
| `NEXT_PUBLIC_APP_URL` | optional | Canonical origin for Checkout / Connect return URLs (defaults to `http://localhost:3000`) |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` (optional) | Mobile stub |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/mobile/.env` (optional) | Mobile stub |

### What Peter creates in the dashboard

- Supabase project
- Email auth enabled + localhost redirect URL
- Schema via the SQL migrations above (init → rls → grants → verification sources → creator ToS → **stripe entitlements** → seed)
- (After first login) `profiles.role = 'admin'` for review queue access
- Stripe account + Connect (see below)

**Already on Alpha schema and need Creator ToS only?** Run this in SQL Editor (same as `20260313000000_creator_tos.sql`):

```sql
alter table public.profiles
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists tos_version text;
```

Creators must accept ToS at `/dashboard/tos` (web) or `/tos` (Expo) before dashboard listings / verification. Acceptance is stored on `profiles` (`tos_accepted_at`, `tos_version`). Bumping `CREATOR_TOS_VERSION` in `@dataonly/core` forces re-accept.

## Stripe Connect purchase flow (Beta slice)

Vertical slice: Accounts v2 recipient onboarding (Express Dashboard) → Checkout with license summary → webhook entitlement → gated access stub.

Connected accounts are created with `POST /v2/core/accounts` (recipient + `stripe_balance.stripe_transfers`) and onboarded via `POST /v2/core/account_links`. Checkout stays a destination charge + application fee on the platform.

### What Peter configures in Stripe Dashboard

1. Create / open a [Stripe](https://dashboard.stripe.com) account (test mode first).
2. **Connect** → enable Connect for a **marketplace** (destination / indirect charges). Complete the platform questionnaire.
3. Acknowledge **platform loss liability** (required when `losses_collector=application` for Express-dashboard recipients). Do **not** rely on Accounts v1 create — this app uses Accounts v2.
4. **Developers → API keys** — copy Publishable + Secret into `apps/web/.env.local` as:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
5. **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR_HOST/api/stripe/webhook` (for local: use [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/stripe/webhook`)
   - Events: `checkout.session.completed`, `account.updated`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET`
6. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set so the webhook can upsert `entitlements`.
7. Optional: `STRIPE_CONNECT_DEFAULT_COUNTRY=us` (ISO alpha-2) for new connected accounts.

### SQL to run (if Alpha schema already applied)

Paste `supabase/migrations/20260314000000_stripe_entitlements.sql` in the Supabase SQL Editor, or the condensed form:

```sql
alter table public.profiles
  add column if not exists stripe_customer_id text;

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

drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "entitlements_admin_all" on public.entitlements;
create policy "entitlements_admin_all" on public.entitlements
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.entitlements to authenticated;
grant select, insert, update, delete on public.entitlements to service_role;
```

### Flow (once keys + SQL are live)

1. Set `NEXT_PUBLIC_APP_URL` to an **HTTPS** origin (Stripe v2 Account Links reject plain `http://localhost`).
2. Creator signs in → `/dashboard` → **Set up payouts** (v2 Account Link → Express-hosted onboarding).
3. After return, dashboard refreshes Connect flags (`stripe_transfers` active ⇒ checkout unlocked).
4. Buyer opens `/datacuts/[slug]` → **Buy datacut** → license summary → Stripe Checkout (destination charge + platform fee).
5. Webhook `checkout.session.completed` upserts `entitlements`.
6. Buyer sees **Open access** (JSON stub until Storage delivery ships). Access is refused without an active entitlement.

### Still stubbed / not in this slice

- Real file download from Supabase Storage (access API returns a gated JSON stub).
- Creator payouts analytics / balance dashboard beyond Connect status.
- Mobile Checkout (Expo still shows mock buy).
- Refund / dispute UI; platform fee % still an open product decision (env default 10%).
- Counsel-finalized full license text (product summaries only).

Without Stripe keys, the UI and APIs return clear `stripe_not_configured` errors — code + migrations still ship.

## Feature map

| Feature | Behavior |
|---------|----------|
| Catalog | Supabase when env set; else mock |
| Auth | Magic link or email/password on Next |
| Creator CRUD | `/dashboard` draft + publish listings |
| Saved | `localStorage` when logged out; `saved` table when logged in |
| Verification | Apply at `/dashboard/verification` (web) or `/verification` (Expo); admin queue at `/admin/verification`. Evidence = **Verified sources** (`sources` jsonb). |
| Creator ToS | Gate at `/dashboard/tos` (web) and `/tos` (Expo) before listings / verification; stores `profiles.tos_accepted_at` + `tos_version`. Draft policy outline until counsel finalizes. |
| Badge | `creators.verified` from DB after approve |
| Purchase | Stripe Checkout + Connect Accounts v2 (recipient / Express); license summary before pay |
| Entitlement | `entitlements` row from webhook; gates `/api/entitlements/access` |

## Scripts

```bash
npm run dev:web          # Next.js
npm run dev:mobile       # Expo
npm run build:web        # Production web build
npm run typecheck        # Workspace typecheck
npm run seed:help        # Print Supabase seed / env steps
```
