import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

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
    // Avoid preferLocalhost: Expo Go Linking events often keep the LAN/emulator
    // host. Scheme-prefix matching below tolerates host drift.
  });
}

/**
 * Prefix used for return-URL matching.
 * Full `exp://127.0.0.1:8081/--/auth/sign-in` is brittle — Expo Go sometimes
 * delivers a slightly different authority. Scheme-only still scopes to our app.
 *
 * Stock Android `openAuthSessionAsync` uses `url.startsWith(redirectUrl)` —
 * pass this prefix (not the full redirectTo) as the second argument.
 */
function getAuthRedirectPrefix(redirectTo: string): string {
  const match = /^(exp|exps|dataonlymobile):\/\//i.exec(redirectTo);
  if (match) return `${match[1].toLowerCase()}://`;
  return redirectTo;
}

function isOAuthReturnUrl(url: string, redirectTo: string): boolean {
  const prefix = getAuthRedirectPrefix(redirectTo);
  if (url.startsWith(prefix) || url.startsWith(redirectTo)) {
    return /[?&#](code|access_token|error|error_code)=/.test(url);
  }
  // Expo Router may surface the path without the exact Metro authority.
  return (
    url.includes(AUTH_CALLBACK_PATH) &&
    /[?&#](code|access_token|error|error_code)=/.test(url)
  );
}

/**
 * Merge query + hash params (PKCE uses query; implicit may put tokens in the hash).
 * Avoid `new URL('exp://…')` — some RN engines reject custom schemes.
 */
function getOAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const qIndex = url.indexOf("?");
  const hIndex = url.indexOf("#");
  const query =
    qIndex >= 0
      ? hIndex > qIndex
        ? url.slice(qIndex + 1, hIndex)
        : url.slice(qIndex + 1)
      : "";
  const hash = hIndex >= 0 ? url.slice(hIndex + 1) : "";
  new URLSearchParams(query).forEach((value, key) => {
    params[key] = value;
  });
  new URLSearchParams(hash).forEach((value, key) => {
    params[key] = value;
  });
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

type OAuthBrowserResult =
  | { type: "success"; url: string }
  | { type: "cancel" };

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Android OAuth browser handoff.
 *
 * Why not `Linking.openURL` (system Chrome)? Chrome blocks many HTTPS →
 * custom-scheme redirects outside a trusted Chrome Custom Tab / user-activation
 * chain. After Google → Supabase `/auth/v1/callback`, the `exp://` /
 * `dataonlymobile://` hop is dropped and the tab stays on a black/blank
 * `*.supabase.co` page (symptom after e439d69).
 *
 * Why not `openAuthSessionAsync(url, fullRedirectTo)` alone? The Android
 * polyfill only accepts `event.url.startsWith(redirectUrl)`. Expo Go often
 * returns a slightly different host than `makeRedirectUri()`, so the deep link
 * is ignored and the Custom Tab spins forever on Google / Supabase.
 *
 * Fix: Chrome Custom Tab via AuthSession, pass **scheme prefix** as redirectUrl,
 * `createTask: false`, keep a parallel Linking capture for path-only returns,
 * and always send `prompt=select_account` so the account tap supplies activation.
 */
async function openOAuthBrowser(
  authUrl: string,
  redirectTo: string,
): Promise<OAuthBrowserResult> {
  if (Platform.OS !== "android") {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type === "success" && result.url) {
      return { type: "success", url: result.url };
    }
    return { type: "cancel" };
  }

  const redirectPrefix = getAuthRedirectPrefix(redirectTo);
  let captured: string | null = null;
  const linkSub = Linking.addEventListener("url", ({ url }) => {
    if (__DEV__) {
      console.log("[oauth] linking url=", url);
    }
    if (isOAuthReturnUrl(url, redirectTo)) {
      captured = url;
    }
  });

  try {
    try {
      await WebBrowser.warmUpAsync();
    } catch {
      // Warm-up is best-effort.
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectPrefix, {
      // Keep the Custom Tab in the app task so Android does not tear it down
      // when the app backgrounds during Google account pick.
      createTask: false,
      showInRecents: true,
    });

    if (result.type === "success" && result.url && isOAuthReturnUrl(result.url, redirectTo)) {
      return { type: "success", url: result.url };
    }

    if (captured) {
      return { type: "success", url: captured };
    }

    // AppState "dismiss" often wins the stock Promise.race before Linking is
    // delivered. Brief grace for a late url event after the tab closes.
    await delay(1000);
    if (captured) {
      return { type: "success", url: captured };
    }

    return { type: "cancel" };
  } finally {
    linkSub.remove();
  }
}

export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
  const redirectTo = getAuthRedirectUrl();
  if (__DEV__) {
    // Copy this exact value into Supabase → Auth → URL Configuration → Redirect URLs
    // (or cover it with dataonlymobile://** / exp://** / exps://**).
    console.log("[oauth] redirectTo=", redirectTo);
    console.log("[oauth] redirectPrefix=", getAuthRedirectPrefix(redirectTo));
  }

  const supabase = createMobileSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Account picker tap = user activation. Silent SSO (no prompt) often ends
      // on a black *.supabase.co page because Chrome blocks the app deep link.
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("Google sign-in didn't start. Try again, or use email instead.");
  }

  const result = await openOAuthBrowser(data.url, redirectTo);
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
