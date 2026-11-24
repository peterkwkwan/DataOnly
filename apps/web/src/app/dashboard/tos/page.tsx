"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  CREATOR_TOS_ACCEPT_LABEL,
  CREATOR_TOS_DRAFT_NOTICE,
  CREATOR_TOS_SECTIONS,
  CREATOR_TOS_VERSION,
  acceptCreatorTos,
  hasAcceptedCreatorTos,
} from "@dataonly/core";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/dashboard/tos")) return "/dashboard";
  return raw;
}

function CreatorTosForm() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyAccepted = hasAcceptedCreatorTos(profile);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      await ensureCreatorForUser(supabase, user, profile?.displayName);
      await acceptCreatorTos(supabase, user.id);
      await refreshProfile();
      router.replace(nextPath);
    } catch (err) {
      setError(formatClientError(err, "Failed to record ToS acceptance"));
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <span className="kicker">Creator Terms</span>
          <h1>Connect Supabase first</h1>
          <p>Creator ToS acceptance is stored on your profile after migrations are applied.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="page-view">
        <p className="empty-hint">Loading…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Sign in required</h1>
          <p>Accept Creator Terms after signing in.</p>
          <Link className="primary-button" href={`/auth/sign-in?next=${encodeURIComponent("/dashboard/tos")}`}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-view tos-view">
      <div className="page-intro">
        <span className="kicker">Creator onboarding</span>
        <h1>Creator Terms of Service</h1>
        <p>
          Accept these terms before listing datacuts or using creator dashboard tools. Personal and
          Commercial license templates on each listing are separate from this acceptance gate.
        </p>
      </div>

      <p className="tos-draft-banner" role="status">
        {CREATOR_TOS_DRAFT_NOTICE}
      </p>
      <p className="form-footnote">
        Version <code>{CREATOR_TOS_VERSION}</code>
        {alreadyAccepted ? (
          <>
            {" "}
            · Accepted {profile?.tosAcceptedAt ? new Date(profile.tosAcceptedAt).toLocaleString() : ""}
          </>
        ) : null}
      </p>

      <ol className="tos-sections">
        {CREATOR_TOS_SECTIONS.map((section) => (
          <li key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </li>
        ))}
      </ol>

      {alreadyAccepted ? (
        <div className="dashboard-actions">
          <Link className="primary-button" href={nextPath}>
            Continue to dashboard
          </Link>
        </div>
      ) : (
        <form className="tos-form listing-form" onSubmit={onSubmit}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              required
            />
            {CREATOR_TOS_ACCEPT_LABEL}
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={!checked || busy}>
              {busy ? "Saving…" : "Accept Creator Terms"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function CreatorTosPage() {
  return (
    <Suspense
      fallback={
        <section className="page-view">
          <p className="empty-hint">Loading…</p>
        </section>
      }
    >
      <CreatorTosForm />
    </Suspense>
  );
}
