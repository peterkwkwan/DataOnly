import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

function signInRedirect(
  origin: string,
  next: string,
  error?: { code: string; description?: string | null },
) {
  const url = new URL("/auth/sign-in", origin);
  if (next && next !== "/") url.searchParams.set("next", next);
  if (error) {
    url.searchParams.set("error", error.code);
    if (error.description?.trim()) {
      url.searchParams.set("error_description", error.description.trim());
    }
  }
  return NextResponse.redirect(url);
}

/** Handles magic-link and OAuth (e.g. Google) PKCE code → session exchange. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/";
  const next = nextRaw.startsWith("/") ? nextRaw : "/";
  const providerError = searchParams.get("error");
  const providerDescription = searchParams.get("error_description");

  if (!isSupabaseConfigured()) {
    return signInRedirect(origin, next);
  }

  // Provider / Supabase returned an OAuth error (user cancel, misconfig, etc.)
  if (providerError) {
    return signInRedirect(origin, next, {
      code: "oauth",
      description: providerDescription || providerError,
    });
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return signInRedirect(origin, next, {
      code: "oauth",
      description: error.message || "Could not complete sign-in.",
    });
  }

  // Bare /auth/callback with no code and no provider error — not a failed attempt.
  return signInRedirect(origin, next);
}
