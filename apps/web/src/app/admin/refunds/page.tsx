"use client";

import {
  isCurrentAccessCharge,
  purchaseStatusPills,
  refundEligibility,
  type RefundEligibilityInput,
} from "@dataonly/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AdminRow = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  paymentIntentId: string | null;
  refundRequestedAt: string | null;
  refundRequestNote: string | null;
  datacutId: number;
  userId: string;
  datacutTitle: string;
  buyerLabel: string;
  entitlementStatus: string | null;
  entitlementDownloadedAt: string | null;
  entitlementPaymentIntentId: string | null;
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

function oneRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function rowInput(row: AdminRow): RefundEligibilityInput {
  return {
    purchaseStatus: row.status,
    purchaseCreatedAt: row.createdAt,
    paymentIntentId: row.paymentIntentId,
    refundRequestedAt: row.refundRequestedAt,
    isCurrentAccessCharge: isCurrentAccessCharge(row.paymentIntentId, row.entitlementPaymentIntentId),
    entitlementStatus: row.entitlementStatus,
    entitlementDownloadedAt: row.entitlementDownloadedAt,
  };
}

export default function AdminRefundsPage() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState<AdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: "refund" | "dismiss" } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadPurchases = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const purchaseSelect =
      "id, status, amount_cents, currency, created_at, refund_requested_at, refund_request_note, stripe_payment_intent_id, user_id, datacut_id, datacuts(title)";
    const withProfiles = await supabase
      .from("purchases")
      .select(`${purchaseSelect}, profiles(email, display_name)`)
      .order("refund_requested_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);

    let data: Record<string, unknown>[] | null = null;
    if (withProfiles.error) {
      const withoutProfiles = await supabase
        .from("purchases")
        .select(purchaseSelect)
        .order("refund_requested_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (withoutProfiles.error) throw withoutProfiles.error;
      data = (withoutProfiles.data ?? []) as Record<string, unknown>[];
    } else {
      data = (withProfiles.data ?? []) as Record<string, unknown>[];
    }

    const userIds = [
      ...new Set(
        (data ?? [])
          .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
          .filter(Boolean),
      ),
    ];
    const entitlements = new Map<
      string,
      { status: string; downloadedAt: string | null; paymentIntentId: string | null }
    >();
    if (userIds.length > 0) {
      const { data: entRows, error: entError } = await supabase
        .from("entitlements")
        .select("user_id, datacut_id, status, downloaded_at, stripe_payment_intent_id")
        .in("user_id", userIds);
      if (entError) throw entError;
      for (const ent of entRows ?? []) {
        entitlements.set(`${ent.user_id}:${ent.datacut_id}`, {
          status: String(ent.status),
          downloadedAt: typeof ent.downloaded_at === "string" ? ent.downloaded_at : null,
          paymentIntentId:
            typeof ent.stripe_payment_intent_id === "string" ? ent.stripe_payment_intent_id : null,
        });
      }
    }

    setItems(
      (data ?? []).map((row) => {
        const cut = oneRel(row.datacuts as { title?: string } | { title?: string }[] | null);
        const profile = oneRel(
          row.profiles as
            | { email?: string | null; display_name?: string | null }
            | { email?: string | null; display_name?: string | null }[]
            | null,
        );
        const userId = typeof row.user_id === "string" ? row.user_id : "";
        const datacutId = Number(row.datacut_id);
        const ent = entitlements.get(`${userId}:${datacutId}`) ?? null;
        return {
          id: String(row.id),
          status: String(row.status),
          amountCents: Number(row.amount_cents) || 0,
          currency: String(row.currency || "usd"),
          createdAt: String(row.created_at),
          paymentIntentId:
            typeof row.stripe_payment_intent_id === "string" ? row.stripe_payment_intent_id : null,
          refundRequestedAt:
            typeof row.refund_requested_at === "string" ? row.refund_requested_at : null,
          refundRequestNote:
            typeof row.refund_request_note === "string" ? row.refund_request_note : null,
          datacutId,
          userId,
          datacutTitle: cut?.title?.trim() || `Datacut #${datacutId}`,
          buyerLabel:
            profile?.display_name?.trim() ||
            profile?.email?.trim() ||
            (userId ? `${userId.slice(0, 8)}…` : "Buyer"),
          entitlementStatus: ent?.status ?? null,
          entitlementDownloadedAt: ent?.downloadedAt ?? null,
          entitlementPaymentIntentId: ent?.paymentIntentId ?? null,
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

  async function refundPurchase(row: AdminRow) {
    const input = rowInput(row);
    const current = input.isCurrentAccessCharge;
    if (
      !window.confirm(
        current
          ? `Refund “${row.datacutTitle}” for ${row.buyerLabel}? The buyer will lose download access.`
          : `Refund “${row.datacutTitle}” for ${row.buyerLabel}? This refunds that charge. Their current download access stays.`,
      )
    ) {
      return;
    }
    setBusy({ id: row.id, action: "refund" });
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: row.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadyRefunded?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      setNote(
        data.alreadyRefunded
          ? "Already refunded — access stays revoked."
          : current
            ? "Refund issued. Buyer download access is revoked."
            : "Refund issued.",
      );
      await loadPurchases();
    } catch (err) {
      setError(formatClientError(err, "Couldn't issue the refund"));
    } finally {
      setBusy(null);
    }
  }

  async function dismissRequest(row: AdminRow) {
    if (
      !window.confirm(
        `Dismiss the refund request for “${row.datacutTitle}”? This does not refund the payment.`,
      )
    ) {
      return;
    }
    setBusy({ id: row.id, action: "dismiss" });
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/refund-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: row.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't dismiss the request");
      setNote("Request dismissed.");
      await loadPurchases();
    } catch (err) {
      setError(formatClientError(err, "Couldn't dismiss the request"));
    } finally {
      setBusy(null);
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
          Buyers request a refund from Account → Purchases. You issue it here. Each Checkout is
          its own line. Refunding the line that currently pays for access removes download access.
          A downloaded line can&apos;t be refunded. A request older than 14 days can still be
          refunded here.
        </p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {note ? <p className="empty-hint">{note}</p> : null}
      <div className="listing-table">
        {items.length === 0 ? (
          <p className="empty-hint">No purchases yet.</p>
        ) : (
          items.map((row) => {
            const input = rowInput(row);
            const gate = refundEligibility(input);
            const downloadBlocked = !gate.ok && gate.code === "downloaded";
            const windowProbe = refundEligibility({ ...input, refundRequestedAt: null });
            const requested = Boolean(row.refundRequestedAt) && row.status !== "refunded";
            const outsideHint =
              requested &&
              !downloadBlocked &&
              windowProbe.ok &&
              windowProbe.outsideWindow;
            const canRefund = gate.ok || (!gate.ok && gate.code === "already_requested");
            const pills = purchaseStatusPills({
              purchaseStatus: row.status,
              refundRequestedAt: row.refundRequestedAt,
              isCurrentAccessCharge: input.isCurrentAccessCharge,
              entitlementStatus: input.entitlementStatus,
            });
            const rowBusy = busy?.id === row.id;
            return (
              <article key={row.id} className="listing-row">
                <div>
                  <b>{row.datacutTitle}</b>
                  <span className="listing-row-meta">
                    {pills.map((pill) => (
                      <span key={pill.label} className={`status-pill status-pill--${pill.modifier}`}>
                        {pill.label}
                      </span>
                    ))}
                    {downloadBlocked ? (
                      <span className="status-pill status-pill--under_review">DOWNLOADED</span>
                    ) : null}
                    <span className="listing-row-meta-detail">
                      {formatMoney(row.amountCents, row.currency)} · {row.buyerLabel} ·{" "}
                      {formatWhen(row.createdAt)}
                    </span>
                  </span>
                  {row.refundRequestNote ? <p>{row.refundRequestNote}</p> : null}
                  {outsideHint ? <p>Outside the 14-day window</p> : null}
                </div>
                <div className="listing-row-actions">
                  {downloadBlocked ? (
                    <span className="empty-hint" title={ALREADY_DOWNLOADED_MSG}>
                      Already downloaded — refund unavailable
                    </span>
                  ) : null}
                  {requested ? (
                    <button
                      type="button"
                      className="text-button"
                      disabled={rowBusy}
                      onClick={() => void dismissRequest(row)}
                    >
                      {rowBusy && busy?.action === "dismiss" ? "Dismissing…" : "Dismiss request"}
                    </button>
                  ) : null}
                  {canRefund ? (
                    <button
                      type="button"
                      className="text-button"
                      disabled={rowBusy}
                      onClick={() => void refundPurchase(row)}
                    >
                      {rowBusy && busy?.action === "refund" ? "Refunding…" : "Refund"}
                    </button>
                  ) : !downloadBlocked && row.status === "refunded" && input.isCurrentAccessCharge ? (
                    <span className="empty-hint">Access revoked</span>
                  ) : !downloadBlocked && !gate.ok && gate.code === "revoked" ? (
                    <span className="empty-hint">Access revoked</span>
                  ) : !downloadBlocked && !gate.ok && gate.code === "missing_payment" ? (
                    <span className="empty-hint">No payment on file for this purchase</span>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
