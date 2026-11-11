# DataOnly

Marketplace for expert-curated **datacuts**. Phase 1 mock catalog still runs with no backend. **Alpha** adds optional Supabase auth, listings, saved lists, and verification.

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
- For Alpha live data: a Supabase project (see below)

```bash
npm install
```

## Run web (mock by default)

```bash
npm run dev:web
# → http://localhost:3000
```

With **no** Supabase env vars, the app uses `packages/core` mock data (same as Phase 1).

Routes: `/` Home · `/explore` · `/creators` · `/datacuts/[slug]` · `/saved` · `/search` · `/auth/sign-in` · `/dashboard` · `/admin/verification`

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
   - `supabase/migrations/20260311000001_rls.sql` (RLS policies)
   - `supabase/seed.sql` (categories / creators / datacuts from mock)
3. **Authentication → Providers** — enable Email (magic link and/or password).
4. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
5. **Project Settings → API** — copy:
   - Project URL
   - `anon` `public` key  
   Do **not** put the `service_role` key in Next.js public env.
6. Create `apps/web/.env.local` from `apps/web/.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

7. Restart `npm run dev:web`. Public catalog pages read published rows from Supabase; if env is missing or queries fail, they fall back to mock.
8. Sign in at `/auth/sign-in`, open `/dashboard` (creates your creator profile), then promote yourself for the admin queue:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

9. Optional Expo stub (`apps/mobile/.env`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Helper reminder script (prints the same steps):

```bash
npm run seed:help
```

### Env vars Peter must set

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Public anon key (safe for browser with RLS) |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` (optional) | Mobile stub |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` (optional) | Mobile stub |

### What Peter creates in the dashboard

- Supabase project
- Email auth enabled + localhost redirect URL
- Schema via the three SQL files above
- (After first login) `profiles.role = 'admin'` for review queue access

Out of scope for this Alpha pass: Stripe, real payouts, file upload beyond listing metadata.

## Alpha feature map

| Feature | Behavior |
|---------|----------|
| Catalog | Supabase when env set; else mock |
| Auth | Magic link or email/password on Next |
| Creator CRUD | `/dashboard` draft + publish listings |
| Saved | `localStorage` when logged out; `saved` table when logged in |
| Verification | Apply at `/dashboard/verification`; admin queue at `/admin/verification` |
| Badge | `creators.verified` from DB after approve |

## Scripts

```bash
npm run dev:web          # Next.js
npm run dev:mobile       # Expo
npm run build:web        # Production web build
npm run typecheck        # Workspace typecheck
npm run seed:help        # Print Supabase seed / env steps
```
