import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, resolveSupabaseEnv } from "@dataonly/core";

/**
 * Expo Alpha: resolves EXPO_PUBLIC_SUPABASE_* when set.
 * Session persistence uses AsyncStorage so apply/submit works across reloads.
 */
export function getMobileSupabaseEnv() {
  return resolveSupabaseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isMobileSupabaseConfigured() {
  return hasSupabaseEnv(getMobileSupabaseEnv() ?? undefined);
}

let client: SupabaseClient | null = null;

export function createMobileSupabaseClient() {
  if (client) return client;
  const env = getMobileSupabaseEnv();
  if (!env) {
    throw new Error(
      "Expo Supabase env missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  client = createClient(env.url, env.anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
