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
   - supabase/seed.sql
3. Auth → URL configuration: add http://localhost:3000/auth/callback
4. Copy Project URL + anon public key into apps/web/.env.local:
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
5. Optional Expo stub: apps/mobile/.env with EXPO_PUBLIC_SUPABASE_*
6. After you sign in once, promote yourself to admin:
   update profiles set role = 'admin' where email = 'you@example.com';

Detected project URL: ${url || "(not set in this shell)"}
`);
