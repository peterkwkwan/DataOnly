import type { SupabasePublicEnv } from "../types";

/** True when both public Supabase URL and anon key are non-empty. */
export function hasSupabaseEnv(env: Partial<SupabasePublicEnv> | null | undefined): boolean {
  return Boolean(env?.url?.trim() && env?.anonKey?.trim());
}

/**
 * Resolve public Supabase env from process/Expo-style maps.
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
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    source.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    source.SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
