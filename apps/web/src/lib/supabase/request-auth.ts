import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthedRequest = {
  user: User | null;
  /** RLS-scoped client (cookie session or Bearer JWT). */
  supabase: SupabaseClient;
};

/**
 * Resolve the signed-in user for API routes.
 * Prefers `Authorization: Bearer <access_token>` (Expo / mobile),
 * otherwise falls back to the cookie session used by the Next web app.
 */
export async function getAuthedRequest(request: Request): Promise<AuthedRequest> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearer) {
    const env = getSupabasePublicEnv();
    if (!env) {
      throw new Error("Supabase env vars are not set");
    }
    const supabase = createClient(env.url, env.anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);
    return { user: error ? null : user, supabase };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
