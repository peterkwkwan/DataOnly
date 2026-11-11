"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!configured) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "magic") {
        const origin = window.location.origin;
        const { error: signError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signError) throw signError;
        setMessage("Check your email for the magic link.");
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) throw signError;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSignUpPassword() {
    setError(null);
    setMessage(null);
    if (!configured) {
      setError("Supabase is not configured.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signError } = await supabase.auth.signUp({ email, password });
      if (signError) throw signError;
      setMessage("Account created. Check your email to confirm if required, then sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-view auth-view">
      <div className="page-intro">
        <span className="kicker">Account</span>
        <h1>Sign in</h1>
        <p>
          Magic link or email + password via Supabase Auth. Without env vars the marketplace still
          runs on the mock catalog.
        </p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "magic" ? "active" : undefined}
            onClick={() => setMode("magic")}
          >
            Magic link
          </button>
          <button
            type="button"
            className={mode === "password" ? "active" : undefined}
            onClick={() => setMode("password")}
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
        {mode === "password" ? (
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {mode === "magic" ? "Email magic link" : "Sign in"}
          </button>
          {mode === "password" ? (
            <button type="button" className="text-button" disabled={busy} onClick={onSignUpPassword}>
              Create account
            </button>
          ) : null}
        </div>
        <p className="form-footnote">
          <Link href="/dashboard">Creator dashboard</Link>
          {" · "}
          <Link href="/">Back home</Link>
        </p>
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
