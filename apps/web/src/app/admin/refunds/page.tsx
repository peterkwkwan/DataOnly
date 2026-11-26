"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type RefundRow = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  paymentIntentId: string | null;
  downloadedAt: string | null;
  datacutTitle: string;
  buyerLabel: string;
};

const ALREADY_DOWNLOADED_MSG =
  "This purchase can't be refunded because the buyer already downloaded the datacut.";

function formatMoney(cents: number, currency: string): string {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminRefundsPage() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState<RefundRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadPurchases = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    // Prefer join to profiles for buyer label; fall back if embed isn't available.
    let data: Record<string, unknown>[] | null = null;
    const withProfiles = await supabase
      .from("entitlements")
      .select(
        "id, status, amount_cents, currency, created_at, downloaded_at, stripe_payment_intent_id, user_id, datacut_id, datacuts(title), profiles(email, display_name)",
      )
      .in("status", ["active", "pending", "refunded"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (withProfiles.error) {
      const withoutProfiles = await supabase
        .from("entitlements")
        .select(
          "id, status, amount_cents, currency, created_at, downloaded_at, stripe_payment_intent_id, user_id, datacut_id, datacuts(title)",
        )
        .in("status", ["active", "pending", "refunded"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (withoutProfiles.error) throw withoutProfiles.error;
      data = (withoutProfiles.data ?? []) as Record<string, unknown>[];
    } else {
      data = (withProfiles.data ?? []) as Record<string, unknown>[];
    }

    setItems(
      (data ?? []).map((row) => {
        const cutRel = row.datacuts as
          | { title?: string }
          | { title?: string }[]
          | null
          | undefined;
        const cut = Array.isArray(cutRel) ? cutRel[0] : cutRel;
        const profileRel = row.profiles as
          | { email?: string | null; display_name?: string | null }
          | { email?: string | null; display_name?: string | null }[]
          | null
          | undefined;
        const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
        const userId = typeof row.user_id === "string" ? row.user_id : "";
        const buyerLabel =
          profile?.display_name?.trim() ||
          profile?.email?.trim() ||
          (userId ? `${userId.slice(0, 8)}…` : "Buyer");

        return {
          id: String(row.id),
          status: String(row.status),
          amountCents: Number(row.amount_cents) || 0,
          currency: String(row.currency || "usd"),
          createdAt: String(row.created_at),
          paymentIntentId:
            typeof row.stripe_payment_intent_id === "string"
              ? row.stripe_payment_intent_id
              : null,
          downloadedAt:
            typeof row.downloaded_at === "string" ? row.downloaded_at : null,
          datacutTitle: cut?.title?.trim() || `Datacut #${row.datacut_id}`,
          buyerLabel,
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (loading || !user || !isAdmin || !isSupabaseConfigured()) return;
    void loadPurchases().catch((err) =>
      setError(formatClientError(err, "Failed to load purchases")),
    );
  }, [isAdmin, loading, loadPurchases, user]);

  async function refundPurchase(row: RefundRow) {
    if (row.status === "refunded") return;
    if (row.downloadedAt) {
      setError(ALREADY_DOWNLOADED_MSG);
      setNote(null);
      return;
    }
    if (
      !window.confirm(
        `Refund “${row.datacutTitle}” for ${row.buyerLabel}? The buyer will lose download access.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: row.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadyRefunded?: boolean;
        status?: string;
        code?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Refund failed");
      }
      setNote(
        data.alreadyRefunded
          ? "Already refunded — access stays revoked."
          : "Refund issued. Buyer download access is revoked.",
      );
      await loadPurchases();
    } catch (err) {
      setError(formatClientError(err, "Couldn't issue the refund"));
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Connect Supabase</h1>
          <p>Admin refunds need Supabase + Stripe configured.</p>
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
        <Link href="/auth/sign-in?next=/admin/refunds">Sign in</Link>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Admin only</h1>
          <p>
            Set <code>profiles.role = &apos;admin&apos;</code> for your user in the Supabase SQL
            editor to issue refunds.
          </p>
          <Link href="/dashboard">Back to dashboard</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Admin</span>
        <h1>Refunds</h1>
        <p>
          Issue a refund for a purchase that has not been downloaded yet. After
          download, refunds are blocked. The buyer loses download access when
          refunded.
        </p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {note ? <p className="empty-hint">{note}</p> : null}
      <div className="listing-table">
        {items.length === 0 ? (
          <p className="empty-hint">No purchases yet.</p>
        ) : (
          items.map((row) => {
            const refunded = row.status === "refunded";
            const downloaded = Boolean(row.downloadedAt);
            const canRefund = !refunded && !downloaded && Boolean(row.paymentIntentId);
            return (
              <article key={row.id} className="listing-row">
                <div>
                  <b>{row.datacutTitle}</b>
                  <span>
                    <span
                      className={`status-pill ${
                        refunded ? "status-pill--revoked" : "status-pill--approved"
                      }`}
                    >
                      {refunded ? "REFUNDED" : "ACTIVE"}
                    </span>
                    {downloaded && !refunded ? (
                      <>
                        {" · "}
                        <span className="status-pill status-pill--under_review">DOWNLOADED</span>
                      </>
                    ) : null}
                    {" · "}
                    {formatMoney(row.amountCents, row.currency)} · {row.buyerLabel} ·{" "}
                    {formatWhen(row.createdAt)}
                  </span>
                </div>
                <div className="listing-row-actions">
                  {refunded ? (
                    <span className="empty-hint">Access revoked</span>
                  ) : downloaded ? (
                    <span className="empty-hint" title={ALREADY_DOWNLOADED_MSG}>
                      Already downloaded — refund unavailable
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busyId === row.id || !canRefund}
                      onClick={() => void refundPurchase(row)}
                      title={
                        row.paymentIntentId
                          ? "Refund this purchase"
                          : "No payment on file for this purchase"
                      }
                    >
                      {busyId === row.id ? "Refunding…" : "Refund"}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
