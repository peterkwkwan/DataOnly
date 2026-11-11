import { createSupabaseClient, hasSupabaseEnv, resolveSupabaseEnv } from "@dataonly/core";

/**
 * Expo Alpha stub: resolves EXPO_PUBLIC_SUPABASE_* when set.
 * Catalog still uses mock until a later pass wires live queries.
 */
export function getMobileSupabaseEnv() {
  return resolveSupabaseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isMobileSupabaseConfigured() {
  return hasSupabaseEnv(getMobileSupabaseEnv() ?? undefined);
}

export function createMobileSupabaseClient() {
  const env = getMobileSupabaseEnv();
  if (!env) {
    throw new Error(
      "Expo Supabase env missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createSupabaseClient(env);
}
