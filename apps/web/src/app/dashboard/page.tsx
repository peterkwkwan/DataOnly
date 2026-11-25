"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { ListingRowMenu } from "@/components/listing-row-menu";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Creator,
  Datacut,
  ListingStatus,
  VerificationApplication,
  VerificationStatus,
} from "@dataonly/core";
import { mapDatacut, mapVerification, type DatacutRow, type VerificationRow } from "@dataonly/core";

const LISTING_PILL_LABELS: Record<ListingStatus, string> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  unpublished: "UNPUBLISHED",
};

function listingStatusPill(status: string | undefined | null): { label: string; status: string } {
  const key = (status ?? "draft").toLowerCase();
  if (key in LISTING_PILL_LABELS) {
    return { label: LISTING_PILL_LABELS[key as ListingStatus], status: key };
  }
  // Any other listing status → uppercase words (license/price stay outside the pill).
  return { label: key.replace(/_/g, " ").toUpperCase(), status: key };
}

function listingStatusPillClass(status: string): string {
  if (status === "published") return "status-pill status-pill--approved";
  if (status === "draft") return "status-pill status-pill--draft";
  if (status === "unpublished") return "status-pill status-pill--rejected";
  return "status-pill status-pill--submitted";
}

const VERIFICATION_PILL_LABELS: Record<VerificationStatus, string> = {
  draft: "DRAFT",
  submitted: "SUBMITTED",
  under_review: "UNDER REVIEW",
  needs_more_info: "ADDITIONAL INFO REQUESTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  revoked: "REVOKED",
};

type PayoutStatus =
  | "unavailable"
  | "not_started"
  | "incomplete"
  | "pending"
  | "active"
  | "needs_update";

const PAYOUT_PILL_LABELS: Record<PayoutStatus, string> = {
  unavailable: "UNAVAILABLE",
  not_started: "NOT STARTED",
  incomplete: "INCOMPLETE",
  pending: "PENDING",
  active: "ACTIVE",
  needs_update: "NEEDS UPDATE",
};

const VIEW_APPLICATION_STATUSES = new Set<VerificationStatus>([
  "submitted",
  "under_review",
  "needs_more_info",
  "rejected",
]);

function verificationStatusPill(
  creator: Creator | null,
  application: VerificationApplication | null,
): { label: string; status: VerificationStatus | "not_applied" | "verified" } {
  if (creator?.verified) return { label: "VERIFIED", status: "verified" };
  if (application?.status) {
    return {
      label: VERIFICATION_PILL_LABELS[application.status],
      status: application.status,
    };
  }
  return { label: "NOT APPLIED", status: "not_applied" };
}

function statusPillClass(status: VerificationStatus | "not_applied" | "verified"): string {
  if (status === "verified") return "status-pill status-pill--approved";
  if (status === "not_applied") return "status-pill status-pill--draft";
  return `status-pill status-pill--${status}`;
}

type ConnectState = {
  configured: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  requirementsPastDue: boolean;
};

function payoutStatusFromConnect(connect: ConnectState): PayoutStatus {
  if (!connect.configured) return "unavailable";
  if (!connect.accountId) return "not_started";
  // Past-due requirements beat "active" — creator must fix Stripe details.
  if (connect.requirementsPastDue) return "needs_update";
  if (connect.onboardingComplete) return "active";
  // Details in, transfers not live yet — Stripe still reviewing.
  if (connect.detailsSubmitted && !connect.chargesEnabled) return "pending";
  // Account exists, onboarding unfinished / currently due.
  return "incomplete";
}

function payoutStatusPill(connect: ConnectState | null): {
  label: string;
  status: PayoutStatus | "loading";
  helper: string | null;
} {
  if (!connect) return { label: "…", status: "loading", helper: null };
  const status = payoutStatusFromConnect(connect);
  const helpers: Record<PayoutStatus, string> = {
    unavailable: "Payouts aren't available right now.",
    not_started: "Finish setup to receive payouts.",
    incomplete: "Finish setup to receive payouts.",
    pending: "Stripe is reviewing your payout details.",
    active: "You can receive sales.",
    needs_update: "Update your payout details to keep receiving sales.",
  };
  return { label: PAYOUT_PILL_LABELS[status], status, helper: helpers[status] };
}

function payoutStatusPillClass(status: PayoutStatus | "loading"): string {
  if (status === "loading") return "status-pill status-pill--draft";
  if (status === "unavailable") return "status-pill status-pill--rejected";
  if (status === "not_started") return "status-pill status-pill--draft";
  if (status === "incomplete") return "status-pill status-pill--submitted";
  if (status === "pending") return "status-pill status-pill--under_review";
  if (status === "active") return "status-pill status-pill--approved";
  return "status-pill status-pill--needs_more_info";
}

export default function DashboardPage() {
  const { user, profile, loading, configured } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [listings, setListings] = useState<Datacut[]>([]);
  const [verification, setVerification] = useState<VerificationApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connect, setConnect] = useState<ConnectState | null>(null);

  async function refreshConnectStatus(sync = false) {
    try {
      const res = await fetch("/api/stripe/connect/status", {
        method: sync ? "POST" : "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load payout status");
      setConnect({
        configured: !!data.configured,
        accountId: data.accountId ?? null,
        chargesEnabled: !!data.chargesEnabled,
        detailsSubmitted: !!data.detailsSubmitted,
        onboardingComplete: !!data.onboardingComplete,
        requirementsPastDue: !!data.requirementsPastDue,
      });
    } catch (err) {
      setConnectMsg(formatClientError(err, "Could not load payout status"));
    }
  }

  async function startConnectOnboarding() {
    setConnectBusy(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      let data: { url?: string; error?: string; code?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setConnectBusy(false);
        setConnectMsg("Couldn't open payout setup. Please try again.");
        return;
      }
      if (!res.ok || !data.url) {
        setConnectBusy(false);
        if (res.status === 401) {
          setConnectMsg("Sign in to set up payouts.");
        } else if (res.status === 503 || data.code === "stripe_not_configured") {
          setConnectMsg("Payouts aren't available right now. Please try again later.");
        } else {
          setConnectMsg("Couldn't open payout setup. Please try again.");
        }
        return;
      }
      // Keep spinner + message until the browser navigates away.
      window.location.href = data.url;
    } catch {
      setConnectBusy(false);
      setConnectMsg("Couldn't open payout setup. Check your connection and try again.");
    }
  }

  async function handleDeleteListing(cut: Datacut) {
    if (!window.confirm(`Delete “${cut.title}”? This cannot be undone.`)) return;
    setDeletingId(cut.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase.from("datacuts").delete().eq("id", cut.id);
      if (deleteError) throw deleteError;
      setListings((prev) => prev.filter((item) => item.id !== cut.id));
    } catch (err) {
      setError(formatClientError(err, "Failed to delete listing"));
    } finally {
      setDeletingId(null);
    }
  }

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
              "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, storage_path, file_name, creators(name, verified), categories(name)",
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
        const params = new URLSearchParams(window.location.search);
        const connectParam = params.get("connect");
        // Always sync from Stripe so past-due → NEEDS UPDATE is accurate.
        await refreshConnectStatus(true);
        if (!cancelled && connectParam === "return") {
          setConnectMsg("Payout settings updated.");
        } else if (!cancelled && connectParam === "refresh") {
          setConnectMsg("Your payout link expired. Try setting up again.");
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

  const verificationPill = verificationStatusPill(creator, verification);
  const payoutPill = payoutStatusPill(connect);
  const hideVerificationButton =
    !!creator?.verified || verification?.status === "approved";
  const verificationButtonLabel =
    verification && VIEW_APPLICATION_STATUSES.has(verification.status)
      ? "View application"
      : "Apply for Verified";

  return (
    <section className="page-view dashboard-view">
      <div className="page-intro">
        <span className="kicker">Creator dashboard</span>
        <h1 className="dashboard-username">
          {creator?.name ?? "Your store"}
          {creator?.verified ? <Verified /> : null}
        </h1>
        {creator ? (
          <Link className="link-button" href={`/creators/${creator.slug}`}>
            View storefront
          </Link>
        ) : null}
        <p>
          {creator?.verified
            ? "Draft and publish datacuts, and manage your storefront."
            : "Draft and publish datacuts, apply for verification, and manage your storefront. Unverified creators can still list and sell."}
        </p>
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
          listings.map((cut) => {
            const listingPill = listingStatusPill(cut.status);
            return (
              <article key={cut.id} className="listing-row">
                <div>
                  <b>{cut.title}</b>
                  <span className="listing-row-meta">
                    <span className={listingStatusPillClass(listingPill.status)}>
                      {listingPill.label}
                    </span>
                    <span className="listing-row-meta-detail">
                      {cut.license} · ${cut.price}
                    </span>
                  </span>
                </div>
                <div className="listing-row-actions">
                  <ListingRowMenu
                    editHref={`/dashboard/listings/${cut.id}`}
                    listingTitle={cut.title}
                    deleting={deletingId === cut.id}
                    onDelete={() => void handleDeleteListing(cut)}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      <section className="dashboard-verification-card" aria-labelledby="dashboard-verification-heading">
        <div className="results-header dashboard-section-toolbar">
          <div>
            <h2 id="dashboard-verification-heading">Verification</h2>
          </div>
          {!hideVerificationButton ? (
            <div className="dashboard-section-actions">
              <Link className="primary-button small" href="/dashboard/verification">
                {verificationButtonLabel}
              </Link>
            </div>
          ) : null}
        </div>
        <p className="dashboard-verification-status">
          <b>Status:</b>
          <span className={statusPillClass(verificationPill.status)}>{verificationPill.label}</span>
        </p>
      </section>

      <section className="dashboard-verification-card" aria-labelledby="dashboard-payouts-heading">
        <div className="results-header dashboard-section-toolbar">
          <div>
            <h2 id="dashboard-payouts-heading">Payouts</h2>
          </div>
          <div className="dashboard-section-actions">
            {connectBusy ? (
              <p className="dashboard-payouts-redirect" role="status" aria-live="polite">
                <span className="dashboard-payouts-spinner" aria-hidden="true" />
                Redirecting to Stripe — don&apos;t close this tab.
              </p>
            ) : (
              <button
                type="button"
                className="primary-button small"
                onClick={() => void startConnectOnboarding()}
              >
                {connect?.onboardingComplete ? "Update payout settings" : "Set up payouts"}
              </button>
            )}
          </div>
        </div>
        <p className="dashboard-verification-status">
          <b>Status:</b>
          <span className={payoutStatusPillClass(payoutPill.status)}>{payoutPill.label}</span>
        </p>
        {payoutPill.helper ? <p className="empty-hint">{payoutPill.helper}</p> : null}
        {connectMsg ? <p className="empty-hint">{connectMsg}</p> : null}
        <p className="empty-hint">
          Buyers can purchase once payouts are set up. DataOnly takes a 10% platform fee.
        </p>
      </section>
    </section>
  );
}
