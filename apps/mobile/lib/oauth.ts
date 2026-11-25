import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { createMobileSupabaseClient } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/** Deep-link back into the existing sign-in screen after Google → Supabase. */
export function getAuthRedirectUrl() {
  return Linking.createURL("/auth/sign-in");
}

/**
 * Complete a Supabase OAuth / magic-link redirect.
 * PKCE returns `?code=`; older implicit redirects may include tokens in the query.
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};

  const errorParam =
    typeof params.error === "string"
      ? params.error
      : typeof params.error_code === "string"
        ? params.error_code
        : null;
  if (errorParam) {
    const desc =
      typeof params.error_description === "string"
        ? params.error_description.replace(/\+/g, " ").trim()
        : null;
    if (errorParam === "access_denied") {
      throw new Error(desc || "Google sign-in was cancelled.");
    }
    throw new Error(desc || "Google sign-in didn't complete. Try again, or use email instead.");
  }

  const supabase = createMobileSupabaseClient();
  const code = typeof params.code === "string" ? params.code : null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken =
    typeof params.access_token === "string" ? params.access_token : null;
  const refreshToken =
    typeof params.refresh_token === "string" ? params.refresh_token : null;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
  const redirectTo = getAuthRedirectUrl();
  const supabase = createMobileSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("Google sign-in didn't start. Try again, or use email instead.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    return { cancelled: true };
  }

  await createSessionFromUrl(result.url);
  return { cancelled: false };
}
