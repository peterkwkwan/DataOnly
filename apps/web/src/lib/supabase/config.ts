import { hasSupabaseEnv, resolveSupabaseEnv } from "@dataonly/core";

/**
 * Static NEXT_PUBLIC_* reads so Next can inline them on the client.
 * Prefers PUBLISHABLE_KEY; ANON_KEY is a temporary fallback.
 */
export function getSupabasePublicEnv() {
  return resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Safe to import from client or server — reads public env only. */
export function isSupabaseConfigured() {
  return hasSupabaseEnv(getSupabasePublicEnv() ?? undefined);
}
