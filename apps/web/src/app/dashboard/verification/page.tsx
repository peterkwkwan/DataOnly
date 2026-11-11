"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, VerificationApplication } from "@dataonly/core";
import { EXTRA_INDUSTRIES, mapVerification, type VerificationRow } from "@dataonly/core";

export default function VerificationApplyPage() {
  const { user, profile, loading } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [identity, setIdentity] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState("");
  const [credentials, setCredentials] = useState("");
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured()) return;
    let cancelled = false;
    async function load() {
      try {
        const supabase = createBrowserSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        if (cancelled) return;
        setCreator(ensured);
        setIdentity(ensured.name);
        const { data } = await supabase
          .from("verification_applications")
          .select("*")
          .eq("creator_id", ensured.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          const app = mapVerification(data as VerificationRow);
          setApplication(app);
          setIdentity(app.identity || ensured.name);
          setIndustries(app.industries);
          setPortfolio(app.portfolioLinks.join("\n"));
          setCredentials(app.credentials ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, profile?.displayName, user]);

  function toggleIndustry(name: string) {
    setIndustries((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!creator || !user) return;
    if (!attested) {
      setError("Attestation is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const links = portfolio
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        creator_id: creator.id,
        status: "submitted",
        identity: identity.trim(),
        industries,
        portfolio_links: links,
        credentials: credentials.trim() || null,
        attestation_accepted_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (application && ["draft", "needs_more_info", "rejected"].includes(application.status)) {
        const { data, error: updateError } = await supabase
          .from("verification_applications")
          .update(payload)
          .eq("id", application.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        setApplication(mapVerification(data as VerificationRow));
      } else {
        const { data, error: insertError } = await supabase
          .from("verification_applications")
          .insert(payload)
          .select("*")
          .single();
        if (insertError) throw insertError;
        setApplication(mapVerification(data as VerificationRow));
      }
      setMessage("Application submitted. An admin will review it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase to apply for verification.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <Link href="/auth/sign-in?next=/dashboard/verification">Sign in</Link>
      </section>
    );
  }

  const locked = application?.status === "submitted" || application?.status === "under_review" || application?.status === "approved";

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Verification</span>
        <h1>Apply for Verified</h1>
        <p>
          Verified is a trust boost, not a paywall. Unverified creators can still list and sell.
        </p>
        {creator?.verified ? <Verified /> : null}
      </div>

      {application ? (
        <div className="status-banner">
          <b>Status:</b> {application.status}
          {application.infoRequestNote ? <p>Info requested: {application.infoRequestNote}</p> : null}
          {application.rejectionReason ? <p>Rejection: {application.rejectionReason}</p> : null}
        </div>
      ) : null}

      <form className="auth-card listing-form" onSubmit={onSubmit}>
        <label>
          Legal / display identity
          <input required value={identity} onChange={(e) => setIdentity(e.target.value)} disabled={locked} />
        </label>
        <fieldset className="chip-fieldset" disabled={locked}>
          <legend>Industries / expertise</legend>
          {[...EXTRA_INDUSTRIES].map((name) => (
            <label key={name} className="chip-option">
              <input
                type="checkbox"
                checked={industries.includes(name)}
                onChange={() => toggleIndustry(name)}
              />
              {name}
            </label>
          ))}
        </fieldset>
        <label>
          Portfolio / evidence links (one per line)
          <textarea
            required
            rows={4}
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          Credentials (optional)
          <textarea
            rows={3}
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            disabled={locked}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={locked}
          />
          I attest that this information is true and that I own or have rights to the claims made.
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={busy || locked || industries.length === 0}>
            {locked ? "Submitted" : busy ? "Submitting…" : "Submit application"}
          </button>
          <Link className="text-button" href="/dashboard">
            Back
          </Link>
        </div>
      </form>
    </section>
  );
}
