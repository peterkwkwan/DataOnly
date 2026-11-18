import type { SupabasePublicEnv } from "../types";

/** True when both public Supabase URL and publishable key are non-empty. */
export function hasSupabaseEnv(env: Partial<SupabasePublicEnv> | null | undefined): boolean {
  return Boolean(env?.url?.trim() && env?.anonKey?.trim());
}

/**
 * Resolve public Supabase env from process/Expo-style maps.
 * Prefers `*_SUPABASE_PUBLISHABLE_KEY`; falls back to legacy `*_SUPABASE_ANON_KEY`
 * so existing `.env.local` keeps working temporarily.
 * Does not invent secrets — returns null when unset.
 */
export function resolveSupabaseEnv(
  source: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): SupabasePublicEnv | null {
  const url =
    source.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    source.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    source.SUPABASE_URL?.trim() ||
    "";
  const anonKey =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    source.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    source.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    // Temporary backward-compat for existing local env files
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    source.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    source.SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
