"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, Datacut, VerificationApplication } from "@dataonly/core";
import { mapDatacut, mapVerification, type DatacutRow, type VerificationRow } from "@dataonly/core";

function verificationStatusLabel(
  creator: Creator | null,
  application: VerificationApplication | null,
): string {
  if (creator?.verified) return "Verified";
  if (application?.status) return application.status;
  return "Not applied";
}

export default function DashboardPage() {
  const { user, profile, loading, configured } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [listings, setListings] = useState<Datacut[]>([]);
  const [verification, setVerification] = useState<VerificationApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!configured || !user) return;

    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        if (cancelled) return;
        setCreator(ensured);
        const [{ data, error: listError }, { data: verificationData }] = await Promise.all([
          supabase
            .from("datacuts")
            .select(
              "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, creators(name), categories(name)",
            )
            .eq("creator_id", ensured.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("verification_applications")
            .select("*")
            .eq("creator_id", ensured.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (listError) throw listError;
        if (!cancelled) {
          setListings(((data ?? []) as DatacutRow[]).map(mapDatacut));
          setVerification(
            verificationData ? mapVerification(verificationData as VerificationRow) : null,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setCreator(null);
          setListings([]);
          setVerification(null);
          setError(formatClientError(err, "Failed to load dashboard"));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, profile?.displayName, user]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <span className="kicker">Creator dashboard</span>
          <h1>Connect Supabase to manage listings</h1>
          <p>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>,
            run migrations + seed, then sign in. The public catalog still works with mock data.
          </p>
          <Link className="primary-button" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (loading || busy) {
    return (
      <section className="page-view">
        <p className="empty-hint">Loading dashboard…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Sign in required</h1>
          <p>Creator tools need an account.</p>
          <Link className="primary-button" href="/auth/sign-in?next=/dashboard">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (error && !creator) {
    return (
      <section className="page-view dashboard-view">
        <div className="page-intro">
          <span className="kicker">Creator dashboard</span>
          <h1>Could not load dashboard</h1>
          <p className="form-error">{error}</p>
          <p>
            Env can be set while the Alpha schema is still missing. Apply{" "}
            <code>supabase/migrations</code> then <code>supabase/seed.sql</code> in the Supabase SQL
            Editor (see README), confirm you are signed in, and reload.
          </p>
          <div className="dashboard-actions">
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Retry
            </button>
            <Link className="text-button" href="/auth/sign-in?next=/dashboard">
              Sign in again
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-view dashboard-view">
      <div className="page-intro">
        <span className="kicker">Creator dashboard</span>
        <h1>{creator?.name ?? "Your store"}</h1>
        {creator ? (
          <Link className="link-button" href={`/creators/${creator.slug}`}>
            View storefront
          </Link>
        ) : null}
        <p>
          Draft and publish datacuts, apply for verification, and manage your storefront.
          {creator?.verified ? " You are Verified." : " Unverified creators can still list and sell."}
        </p>
        {creator?.verified ? <Verified /> : null}
      </div>

      {error ? <p className="form-error dashboard-inline-error">{error}</p> : null}

      <div className="results-header dashboard-section-toolbar">
        <div>
          <h2>Your listings</h2>
          <span>{listings.length}</span>
        </div>
        <div className="dashboard-section-actions">
          <Link className="primary-button small" href="/dashboard/listings/new">
            New listing
          </Link>
        </div>
      </div>

      <div className="listing-table">
        {error ? (
          <p className="empty-hint">Listings unavailable until the error above is fixed.</p>
        ) : listings.length === 0 ? (
          <p className="empty-hint">No listings yet. Create a draft to get started.</p>
        ) : (
          listings.map((cut) => (
            <article key={cut.id} className="listing-row">
              <div>
                <b>{cut.title}</b>
                <span>
                  <span
                    className={`listing-status listing-status--${cut.status ?? "draft"}`}
                  >
                    {cut.status ?? "draft"}
                  </span>
                  {" · "}
                  {cut.license} · ${cut.price}
                </span>
              </div>
              <Link href={`/dashboard/listings/${cut.id}`}>Edit</Link>
            </article>
          ))
        )}
      </div>

      <section className="dashboard-verification-card" aria-labelledby="dashboard-verification-heading">
        <div className="results-header dashboard-section-toolbar">
          <div>
            <h2 id="dashboard-verification-heading">Verification</h2>
          </div>
          <div className="dashboard-section-actions">
            <Link className="primary-button small" href="/dashboard/verification">
              Apply for Verified
            </Link>
          </div>
        </div>
        <p className="dashboard-verification-status">
          <b>Status:</b> {verificationStatusLabel(creator, verification)}
          {verification?.infoRequestNote ? (
            <span> Info requested: {verification.infoRequestNote}</span>
          ) : null}
          {verification?.rejectionReason ? (
            <span> Rejection: {verification.rejectionReason}</span>
          ) : null}
        </p>
      </section>
    </section>
  );
}
