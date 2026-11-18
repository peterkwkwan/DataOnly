"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export { isSupabaseConfigured };

export function createBrowserSupabaseClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("Supabase env vars are not set");
  }
  return createBrowserClient(env.url, env.anonKey);
}
