import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform, type AppStateStatus } from "react-native";

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
    // Expo Go on Android emulator: stabilize host (IP → localhost) so the
    // Supabase redirectTo and Linking prefix checks agree.
    preferLocalhost: true,
  });
}

/**
 * Prefix used for return-URL matching.
 * Full `exp://127.0.0.1:8081/--/auth/sign-in` is brittle — Expo Go sometimes
 * delivers a slightly different authority. Scheme-only still scopes to our app.
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

/**
 * Android: `openAuthSessionAsync` is a Custom Tabs + AppState + Linking polyfill
 * with strict `url.startsWith(redirectTo)` matching. On Expo Go / emulator, Google's
 * "Choose an account" page often spins forever after pick because the Custom Tab
 * never hands `exp://…` / `dataonlymobile://…` back to the app.
 *
 * Open the **system browser** (`Linking.openURL`) and complete via our own Linking
 * listener — Android intent resolution returns custom schemes far more reliably
 * than Chrome Custom Tabs. iOS keeps ASWebAuthenticationSession.
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

  return await new Promise<OAuthBrowserResult>((resolve, reject) => {
    let settled = false;
    let browserOpened = false;
    let appStateReady = AppState.currentState !== null;

    const finish = (result: OAuthBrowserResult) => {
      if (settled) return;
      settled = true;
      linkSub.remove();
      appSub.remove();
      resolve(result);
    };

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      if (!isOAuthReturnUrl(url, redirectTo)) return;
      finish({ type: "success", url });
    });

    const onAppState = (state: AppStateStatus) => {
      if (!appStateReady) {
        appStateReady = true;
        return;
      }
      // User switched back to the app without a deep link (closed/abandoned browser).
      if (state === "active" && browserOpened && !settled) {
        setTimeout(() => {
          if (!settled) finish({ type: "cancel" });
        }, 500);
      }
    };
    const appSub = AppState.addEventListener("change", onAppState);

    void Linking.openURL(authUrl)
      .then((opened) => {
        browserOpened = opened;
        if (!opened && !settled) {
          finish({ type: "cancel" });
        }
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        linkSub.remove();
        appSub.remove();
        reject(err);
      });
  });
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
      // Avoid prompt=select_account on Android: that interstitial is where
      // Custom Tabs commonly spin forever after pick. Silent/default Google
      // UX is fine once redirect handoff works; iOS still benefits from a
      // visible picker when multiple accounts exist.
      ...(Platform.OS === "ios"
        ? { queryParams: { prompt: "select_account" } }
        : {}),
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("Google sign-in didn't start. Try again, or use email instead.");
  }

  if (Platform.OS !== "android") {
    try {
      await WebBrowser.warmUpAsync();
    } catch {
      // Warm-up is best-effort (iOS AuthSession).
    }
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
