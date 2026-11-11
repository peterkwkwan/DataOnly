import { hasSupabaseEnv } from "@dataonly/core";

/** Safe to import from client or server — reads public env only. */
export function isSupabaseConfigured() {
  return hasSupabaseEnv({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
