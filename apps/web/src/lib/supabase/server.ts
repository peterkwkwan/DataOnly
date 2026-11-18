import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export { isSupabaseConfigured };

export async function createServerSupabaseClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("Supabase env vars are not set");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Called from a Server Component — middleware will refresh sessions. */
        }
      },
    },
  });
}
