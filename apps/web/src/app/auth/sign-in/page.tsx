"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** Basic check: local@domain.tld (requires @ and a TLD-ish domain segment). */
function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

type AuthMethod = "magic" | "password";
type PasswordIntent = "sign-in" | "create";

function GoogleMark() {
  return (
    <svg className="oauth-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const authError = searchParams.get("error");
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<AuthMethod>("magic");
  const [passwordIntent, setPasswordIntent] = useState<PasswordIntent>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    authError === "auth" ? "Sign-in failed. Try again." : null,
  );
  const [busy, setBusy] = useState(false);
  const emailOk = isValidEmail(email);
  const canSubmit =
    !busy && emailOk && (method === "magic" || password.length >= 6);
  const creating = method === "password" && passwordIntent === "create";

  function switchMethod(nextMethod: AuthMethod) {
    setMethod(nextMethod);
    setPasswordIntent("sign-in");
    setError(null);
    setMessage(null);
  }

  function switchPasswordIntent(nextIntent: PasswordIntent) {
    setPasswordIntent(nextIntent);
    setError(null);
    setMessage(null);
  }

  async function onGoogleSignIn() {
    setError(null);
    setMessage(null);
    if (!configured) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const origin = window.location.origin;
      const { error: signError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (signError) throw signError;
      // Browser navigates to Google; keep busy until unload.
    } catch (err) {
      setError(formatClientError(err, "Google sign-in failed"));
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!emailOk) {
      setError("Enter a valid email address.");
      return;
    }
    if (!configured) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      if (method === "magic") {
        const origin = window.location.origin;
        const { error: signError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signError) throw signError;
        setMessage("Check your email for the magic link.");
      } else if (passwordIntent === "create") {
        const { error: signError } = await supabase.auth.signUp({ email, password });
        if (signError) throw signError;
        setMessage("Account created. Check your email to confirm if required, then sign in.");
        setPasswordIntent("sign-in");
      } else {
        // Sign-in mode only — never call signUp here.
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) throw signError;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(
        formatClientError(
          err,
          creating ? "Sign-up failed" : "Sign-in failed",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-view auth-view">
      <div className="page-intro">
        <span className="kicker">Account</span>
        <h1>{creating ? "Create account" : "Sign in"}</h1>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <button
          type="button"
          className="secondary-button oauth-button"
          disabled={busy}
          onClick={() => void onGoogleSignIn()}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <div className="auth-divider" role="separator">
          <span>or</span>
        </div>
        <div className="auth-tabs">
          <button
            type="button"
            className={method === "magic" ? "active" : undefined}
            onClick={() => switchMethod("magic")}
          >
            Magic link
          </button>
          <button
            type="button"
            className={method === "password" ? "active" : undefined}
            onClick={() => switchMethod("password")}
          >
            Email + password
          </button>
        </div>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
        {method === "password" ? (
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={creating ? "new-password" : "current-password"}
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={!canSubmit}>
            {method === "magic"
              ? "Email magic link"
              : creating
                ? "Create account"
                : "Sign in"}
          </button>
          {method === "password" ? (
            creating ? (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => switchPasswordIntent("sign-in")}
              >
                Already have an account? Sign in
              </button>
            ) : (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => switchPasswordIntent("create")}
              >
                Need an account? Create account
              </button>
            )
          ) : null}
        </div>
      </form>
    </section>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<section className="page-view"><p>Loading…</p></section>}>
      <SignInForm />
    </Suspense>
  );
}
