"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, VerificationApplication, VerificationStatus } from "@dataonly/core";
import { mapVerification, type VerificationRow } from "@dataonly/core";

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
  | "needs_update"
  | "error";

const PAYOUT_PILL_LABELS: Record<PayoutStatus, string> = {
  unavailable: "UNAVAILABLE",
  not_started: "NOT STARTED",
  incomplete: "INCOMPLETE",
  pending: "PENDING",
  active: "ACTIVE",
  needs_update: "NEEDS UPDATE",
  error: "ERROR",
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

function payoutStatusPill(
  connect: ConnectState | null,
  connectFailed: boolean,
): {
  label: string;
  status: PayoutStatus | "loading";
  helper: string | null;
} {
  if (connectFailed && !connect) {
    return {
      label: PAYOUT_PILL_LABELS.error,
      status: "error",
      helper: "Couldn't load payout status. Try again.",
    };
  }
  if (!connect) return { label: "…", status: "loading", helper: null };
  const status = payoutStatusFromConnect(connect);
  const helpers: Record<PayoutStatus, string> = {
    unavailable: "Payouts aren't available right now.",
    not_started: "Finish setup to receive payouts.",
    incomplete: "Finish setup to receive payouts.",
    pending: "Stripe is reviewing your payout details.",
    active: "You can receive sales.",
    needs_update: "Update your payout details to keep receiving sales.",
    error: "Couldn't load payout status. Try again.",
  };
  return { label: PAYOUT_PILL_LABELS[status], status, helper: helpers[status] };
}

function payoutStatusPillClass(status: PayoutStatus | "loading"): string {
  if (status === "loading") return "status-pill status-pill--draft";
  if (status === "unavailable" || status === "error") {
    return "status-pill status-pill--rejected";
  }
  if (status === "not_started") return "status-pill status-pill--draft";
  if (status === "incomplete") return "status-pill status-pill--submitted";
  if (status === "pending") return "status-pill status-pill--under_review";
  if (status === "active") return "status-pill status-pill--approved";
  return "status-pill status-pill--needs_more_info";
}

export default function AccountPage() {
  const { user, profile, loading, configured } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [verification, setVerification] = useState<VerificationApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [connectFailed, setConnectFailed] = useState(false);

  async function refreshConnectStatus(sync = false) {
    try {
      const res = await fetch("/api/stripe/connect/status", {
        method: sync ? "POST" : "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load payout status");
      setConnectFailed(false);
      setConnect({
        configured: !!data.configured,
        accountId: data.accountId ?? null,
        chargesEnabled: !!data.chargesEnabled,
        detailsSubmitted: !!data.detailsSubmitted,
        onboardingComplete: !!data.onboardingComplete,
        requirementsPastDue: !!data.requirementsPastDue,
      });
    } catch (err) {
      setConnectFailed(true);
      setConnectMsg("Couldn't load payout status. Try again.");
      console.error("[account payouts]", formatClientError(err, "Could not load payout status"));
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
        const { data: verificationData, error: verificationError } = await supabase
          .from("verification_applications")
          .select("*")
          .eq("creator_id", ensured.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (verificationError) throw verificationError;
        if (!cancelled) {
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
          setVerification(null);
          setError(formatClientError(err, "Failed to load account"));
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
          <span className="kicker">Account</span>
          <h1>Connect Supabase to manage your account</h1>
          <p>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>,
            then sign in.
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
        <p className="empty-hint">Loading account…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Sign in required</h1>
          <p>Account settings need an account.</p>
          <Link className="primary-button" href="/auth/sign-in?next=/account">
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
          <span className="kicker">Account</span>
          <h1>Could not load account</h1>
          <p className="form-error">{error}</p>
          <div className="dashboard-actions">
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Retry
            </button>
            <Link className="text-button" href="/auth/sign-in?next=/account">
              Sign in again
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const verificationPill = verificationStatusPill(creator, verification);
  const payoutPill = payoutStatusPill(connect, connectFailed);
  const hideVerificationButton =
    !!creator?.verified || verification?.status === "approved";
  const verificationButtonLabel =
    verification && VIEW_APPLICATION_STATUSES.has(verification.status)
      ? "View application"
      : "Apply for Verified";
  const payoutActionBlocked =
    connectFailed ||
    !connect ||
    !connect.configured ||
    payoutPill.status === "unavailable" ||
    payoutPill.status === "error";

  return (
    <section className="page-view dashboard-view">
      <div className="page-intro">
        <span className="kicker">Account</span>
        <h1 className="dashboard-username">
          {creator?.name ?? profile?.displayName ?? "Your account"}
          {creator?.verified ? <Verified /> : null}
        </h1>
        <p>Verification and payout settings for your seller account.</p>
        <Link className="link-button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      {error ? <p className="form-error dashboard-inline-error">{error}</p> : null}

      <section className="dashboard-verification-card" aria-labelledby="account-verification-heading">
        <div className="results-header dashboard-section-toolbar">
          <div>
            <h2 id="account-verification-heading">Verification</h2>
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

      <section className="dashboard-verification-card" aria-labelledby="account-payouts-heading">
        <div className="results-header dashboard-section-toolbar">
          <div>
            <h2 id="account-payouts-heading">Payouts</h2>
          </div>
          <div className="dashboard-section-actions">
            {connectBusy ? (
              <p className="dashboard-payouts-redirect" role="status" aria-live="polite">
                <span className="dashboard-payouts-spinner" aria-hidden="true" />
                Redirecting to Stripe — don&apos;t close this tab.
              </p>
            ) : connectFailed ? (
              <button
                type="button"
                className="primary-button small"
                onClick={() => {
                  setConnectMsg(null);
                  void refreshConnectStatus(true);
                }}
              >
                Retry
              </button>
            ) : payoutActionBlocked ? null : (
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
        {connectMsg && connectMsg !== payoutPill.helper ? (
          <p className={connectFailed ? "form-error" : "empty-hint"}>{connectMsg}</p>
        ) : null}
        {!connectFailed ? (
          <p className="empty-hint">
            {payoutPill.status === "not_started" || payoutPill.status === "incomplete"
              ? "No payout account yet. Set up payouts so buyers can purchase your listings."
              : "Buyers can purchase once payouts are set up. DataOnly takes a 10% platform fee."}
          </p>
        ) : null}
      </section>
    </section>
  );
}
