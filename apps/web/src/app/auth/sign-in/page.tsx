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

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<AuthMethod>("magic");
  const [passwordIntent, setPasswordIntent] = useState<PasswordIntent>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
