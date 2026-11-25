import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { createMobileSupabaseClient } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Deep-link path after Google → Supabase. No leading slash: `Linking.createURL("/…")`
 * emits `scheme:///path` (triple slash) in native builds, which Android Custom Tabs
 * and Supabase allow-list matching often fail to treat as the same redirect.
 */
const AUTH_CALLBACK_PATH = "auth/sign-in";

/** Deep-link back into the existing sign-in screen after Google → Supabase. */
export function getAuthRedirectUrl() {
  return makeRedirectUri({
    scheme: "dataonlymobile",
    path: AUTH_CALLBACK_PATH,
  });
}

/** Merge query + hash params (PKCE uses query; implicit may put tokens in the hash). */
function getOAuthParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const params: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (parsed.hash) {
    new URLSearchParams(parsed.hash.replace(/^#/, "")).forEach((value, key) => {
      params[key] = value;
    });
  }
  return params;
}

/**
 * Complete a Supabase OAuth / magic-link redirect.
 * PKCE returns `?code=`; older implicit redirects may include tokens in the hash/query.
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = getOAuthParams(url);

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
  if (__DEV__) {
    // Copy this exact value into Supabase → Auth → URL Configuration → Redirect URLs
    // (or cover it with dataonlymobile://** / exp://** / exps://**).
    console.log("[oauth] redirectTo=", redirectTo);
  }

  const supabase = createMobileSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Surface Google account picker so the Custom Tab is not a silent bounce
      // that leaves a blank supabase.co callback page when redirectTo mismatches.
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("Google sign-in didn't start. Try again, or use email instead.");
  }

  try {
    await WebBrowser.warmUpAsync();
  } catch {
    // Warm-up is best-effort; AuthSession still works without it.
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    return { cancelled: true };
  }

  const created = await createSessionFromUrl(result.url);
  if (!created) {
    throw new Error(
      "Google returned to the app without a session. Confirm Supabase Redirect URLs allow this app's redirect (Metro: [oauth] redirectTo=).",
    );
  }
  return { cancelled: false };
}
