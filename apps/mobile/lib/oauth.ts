import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { createMobileSupabaseClient } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Same deep-link path as Fudget’s `auth/callback`, but reuse the existing
 * sign-in screen. No leading slash — avoids `scheme:///…` triple-slash URIs.
 */
const AUTH_CALLBACK_PATH = "auth/sign-in";

/** Deep-link back into the sign-in screen after Google → Supabase. */
export function getAuthRedirectUrl() {
  return makeRedirectUri({
    scheme: "dataonlymobile",
    path: AUTH_CALLBACK_PATH,
  });
}

/**
 * Android AuthSession only accepts `url.startsWith(redirectUrl)`.
 * Expo Go / emulator Linking often differs slightly from `makeRedirectUri()`,
 * so pass the scheme prefix to openAuthSessionAsync and filter tokens ourselves.
 */
function getAuthRedirectPrefix(redirectTo: string): string {
  const match = /^(exp|exps|dataonlymobile):\/\//i.exec(redirectTo);
  if (match) return `${match[1].toLowerCase()}://`;
  return redirectTo;
}

function isOAuthReturnUrl(url: string, redirectTo: string): boolean {
  const prefix = getAuthRedirectPrefix(redirectTo);
  if (url.startsWith(prefix) || url.startsWith(redirectTo)) {
    return /[?&#](access_token|error|error_code)=/.test(url);
  }
  return (
    url.includes(AUTH_CALLBACK_PATH) &&
    /[?&#](access_token|error|error_code)=/.test(url)
  );
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

type OAuthBrowserResult =
  | { type: "success"; url: string }
  | { type: "cancel" };

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Android: Custom Tab + scheme-prefix match + Linking capture.
 * Do not use `Linking.openURL` (system Chrome blocks HTTPS → app scheme).
 * Do not pass full redirectTo alone (AuthSession startsWith misses host drift).
 * iOS: same plain AuthSession as Fudget.
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
      // Keep Custom Tab in the app task — default createTask:true dismisses
      // the session when the emulator backgrounds during Google account pick.
      createTask: false,
      showInRecents: true,
    });

    if (result.type === "success" && result.url && isOAuthReturnUrl(result.url, redirectTo)) {
      return { type: "success", url: result.url };
    }

    if (captured) {
      return { type: "success", url: captured };
    }

    // AppState "dismiss" can win before Linking delivers the deep link.
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
      queryParams: {
        access_type: "offline",
        // Account picker tap = user activation so Custom Tabs allow the
        // HTTPS → dataonlymobile:// / exp:// hop after Supabase callback.
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
