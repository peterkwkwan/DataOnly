import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { createMobileSupabaseClient } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Same pattern as Fudget (`apps/mobile/lib/auth.tsx`): custom-scheme redirect +
 * `openAuthSessionAsync(url, redirectTo)` + tokens via `setSession`.
 * No leading slash on path — avoids `scheme:///…` triple-slash URIs.
 */
const AUTH_CALLBACK_PATH = "auth/sign-in";

const redirectTo = makeRedirectUri({
  scheme: "dataonlymobile",
  path: AUTH_CALLBACK_PATH,
});

/** Deep-link back into the sign-in screen after Google → Supabase. */
export function getAuthRedirectUrl() {
  return redirectTo;
}

/** Parse OAuth tokens from query string or hash fragment (Fudget-compatible). */
function getParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parsed = Linking.parse(url);
  if (parsed.queryParams) {
    for (const [key, value] of Object.entries(parsed.queryParams)) {
      if (typeof value === "string") params[key] = value;
    }
  }
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    for (const part of hash.split("&")) {
      const [rawKey, rawValue] = part.split("=");
      if (!rawKey) continue;
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue ?? "");
    }
  }
  return params;
}

/**
 * Complete a Supabase OAuth redirect (implicit tokens in query/hash).
 * Matches Fudget: no PKCE `exchangeCodeForSession`.
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = getParamsFromUrl(url);

  if (params.error || params.error_code) {
    const desc = (params.error_description || params.error || params.error_code || "")
      .replace(/\+/g, " ")
      .trim();
    if (params.error === "access_denied" || params.error_code === "access_denied") {
      throw new Error(desc || "Google sign-in was cancelled.");
    }
    throw new Error(desc || "Google sign-in didn't complete. Try again, or use email instead.");
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken || !refreshToken) {
    return false;
  }

  const supabase = createMobileSupabaseClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return true;
}

export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
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
      // Same queryParams as working Fudget Google OAuth.
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
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

  const created = await createSessionFromUrl(result.url);
  if (!created) {
    throw new Error(
      "Google returned to the app without a session. Confirm Supabase Redirect URLs allow this app's redirect (Metro: [oauth] redirectTo=).",
    );
  }
  return { cancelled: false };
}
