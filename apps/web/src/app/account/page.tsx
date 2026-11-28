"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AccountPurchases, PurchaseHistory } from "@/components/account-purchases";
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

const VIEW_APPLICATION_STATUSES = new Set<VerificationStatus>([
  "submitted",
  "under_review",
  "needs_more_info",
  "rejected",
]);

type AccountTab = "account" | "profile" | "purchases" | "payment";

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

function tabFromSearch(params: { get(name: string): string | null }): AccountTab {
  const connect = params.get("connect");
  if (connect === "return" || connect === "refresh" || params.get("tab") === "payment") {
    return "payment";
  }
  if (params.get("tab") === "purchases") return "purchases";
  if (params.get("tab") === "profile") return "profile";
  return "account";
}

function accountPath(params: { get(name: string): string | null }): string {
  const connect = params.get("connect");
  if (connect === "return" || connect === "refresh") return `/account?connect=${connect}`;
  const tab = tabFromSearch(params);
  if (tab === "account") return "/account";
  return `/account?tab=${tab}`;
}

function introFor(tab: AccountTab): string {
  if (tab === "profile") return "Name, avatar, and bio on your public storefront.";
  if (tab === "payment") return "Payouts and a payment method.";
  if (tab === "purchases") return "Your purchase history.";
  return "Verification for your seller account.";
}

function AccountPageContent() {
  const searchParams = useSearchParams();
  const { user, profile, loading, configured } = useAuth();
  const [tab, setTab] = useState<AccountTab>(() => tabFromSearch(searchParams));
  const [creator, setCreator] = useState<Creator | null>(null);
  const [verification, setVerification] = useState<VerificationApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(true);

  const signInHref = `/auth/sign-in?next=${encodeURIComponent(accountPath(searchParams))}`;

  useEffect(() => {
    if (loading) return;
    if (!configured || !user) {
      setAccountBusy(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setAccountBusy(true);
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
      } catch (err) {
        if (!cancelled) {
          setCreator(null);
          setVerification(null);
          setError(formatClientError(err, "Failed to load account"));
        }
      } finally {
        if (!cancelled) setAccountBusy(false);
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
          <Link className="primary-button" href={signInHref}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
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
          <Link className="primary-button" href={signInHref}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  function selectTab(next: AccountTab) {
    setTab(next);
    const path = next === "account" ? "/account" : `/account?tab=${next}`;
    window.history.replaceState(null, "", path);
  }

  const verificationPill = verificationStatusPill(creator, verification);
  const hideVerificationButton = !!creator?.verified || verification?.status === "approved";
  const verificationButtonLabel =
    verification && VIEW_APPLICATION_STATUSES.has(verification.status)
      ? "View application"
      : "Apply for Verified";

  return (
    <section className="page-view dashboard-view">
      <div className="page-intro">
        <span className="kicker">Account</span>
        <h1 className="dashboard-username">
          {creator?.name ?? profile?.displayName ?? "Your account"}
          {creator?.verified ? <Verified /> : null}
        </h1>
        <p>{introFor(tab)}</p>
      </div>

      <div className="filter-row dashboard-tabs account-tabs" role="tablist" aria-label="Account sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "account"}
          className={tab === "account" ? "active" : undefined}
          onClick={() => selectTab("account")}
        >
          Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "profile"}
          className={tab === "profile" ? "active" : undefined}
          onClick={() => selectTab("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "purchases"}
          className={tab === "purchases" ? "active" : undefined}
          onClick={() => selectTab("purchases")}
        >
          Purchases
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "payment"}
          className={tab === "payment" ? "active" : undefined}
          onClick={() => selectTab("payment")}
        >
          Payment
        </button>
      </div>

      {tab === "account" ? (
        accountBusy ? (
          <p className="empty-hint">Loading account…</p>
        ) : error && !creator ? (
          <div className="page-intro">
            <p className="form-error">{error}</p>
            <div className="dashboard-actions">
              <button type="button" className="primary-button" onClick={() => window.location.reload()}>
                Retry
              </button>
              <Link className="text-button" href={signInHref}>
                Sign in again
              </Link>
            </div>
          </div>
        ) : (
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
        )
      ) : null}

      <div hidden={tab !== "profile"}>
        {creator ? (
          <AccountProfile userId={user.id} creator={creator} onSaved={setCreator} />
        ) : accountBusy ? (
          <p className="empty-hint">Loading account…</p>
        ) : (
          <p className="form-error">{error ?? "Failed to load account"}</p>
        )}
      </div>

      <div hidden={tab !== "purchases"}>
        <PurchaseHistory userId={user.id} />
      </div>
      <div hidden={tab !== "payment"}>
        <AccountPurchases
          userId={user.id}
          connectQuery={searchParams.get("connect")}
          accountReady={!accountBusy}
        />
      </div>
    </section>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <section className="page-view">
          <p className="empty-hint">Loading account…</p>
        </section>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
