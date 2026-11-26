#!/usr/bin/env node
/**
 * Prints the recommended seed path. Arbitrary SQL cannot run through PostgREST
 * without a custom RPC, so Alpha seeding is done in the Supabase SQL editor.
 *
 * Env (optional check only — never invent secrets):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (dashboard only; do not commit)
 */
const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";

console.log(`DataOnly seed helper
====================
1. Create a Supabase project (https://supabase.com/dashboard)
2. In SQL Editor, run in order:
   - supabase/migrations/20260311000000_init.sql
   - supabase/migrations/20260311000001_rls.sql
   - supabase/migrations/20260311000002_grants.sql  (or paste if you already ran older init+rls)
   - supabase/migrations/20260312000000_verification_sources.sql  (if DB already had init without sources)
   - supabase/migrations/20260313000000_creator_tos.sql  (profiles.tos_accepted_at + tos_version)
   - supabase/migrations/20260314000000_stripe_entitlements.sql  (Connect fields + entitlements)
   - supabase/migrations/20260318000000_service_role_creators_grant.sql  (service_role SELECT/UPDATE on creators)
   - supabase/seed.sql
3. Auth → URL configuration: add http://localhost:3000/auth/callback
4. Copy Project URL + publishable key into apps/web/.env.local:
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # required for Stripe webhook entitlement writes
5. Beta Stripe (optional until live buys):
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
   STRIPE_SECRET_KEY=...
   STRIPE_WEBHOOK_SECRET=...
   # stripe listen --forward-to localhost:3000/api/stripe/webhook
6. Optional Expo stub: apps/mobile/.env with EXPO_PUBLIC_SUPABASE_*
7. After you sign in once, promote yourself to admin:
   update profiles set role = 'admin' where email = 'you@example.com';

Detected project URL: ${url || "(not set in this shell)"}
`);
