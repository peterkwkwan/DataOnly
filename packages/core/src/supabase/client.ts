import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabasePublicEnv } from "../types";

/** Browser / shared anon client. Pass URL + anon key from env — never hard-code secrets. */
export function createSupabaseClient(env: SupabasePublicEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
