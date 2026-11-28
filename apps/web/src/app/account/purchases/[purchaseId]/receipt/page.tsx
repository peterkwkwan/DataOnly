"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ReceiptRow = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  license: string;
  createdAt: string;
  paymentIntentId: string | null;
  title: string;
};

function oneRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

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

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export default function PurchaseReceiptPage() {
  const params = useParams<{ purchaseId: string }>();
  const purchaseId = typeof params.purchaseId === "string" ? params.purchaseId : "";
  const { user, profile, loading, configured } = useAuth();
  const [row, setRow] = useState<ReceiptRow | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInHref = `/auth/sign-in?next=${encodeURIComponent(
    `/account/purchases/${purchaseId}/receipt`,
  )}`;
  const buyer =
    profile?.displayName?.trim() ||
    profile?.email ||
    user?.email ||
    "Signed-in buyer";

  useEffect(() => {
    if (loading) return;
    if (!configured || !user || !purchaseId || !isSupabaseConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    async function load() {
      setError(null);
      setMissing(false);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: loadError } = await supabase
          .from("purchases")
          .select(
            "id, status, amount_cents, currency, license, created_at, stripe_payment_intent_id, datacut_id, datacuts(title)",
          )
          .eq("id", purchaseId)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!data) {
          if (!cancelled) {
            setMissing(true);
            setRow(null);
          }
          return;
        }
        const cut = oneRel(data.datacuts as { title?: string } | { title?: string }[] | null);
        const datacutId = Number(data.datacut_id);
        if (!cancelled) {
          setRow({
            id: String(data.id),
            status: String(data.status),
            amountCents: Number(data.amount_cents) || 0,
            currency: String(data.currency || "usd"),
            license: String(data.license || "personal"),
            createdAt: String(data.created_at),
            paymentIntentId:
              typeof data.stripe_payment_intent_id === "string"
                ? data.stripe_payment_intent_id
                : null,
            title: cut?.title?.trim() || `Datacut #${datacutId}`,
          });
        }
      } catch (err) {
        if (!cancelled) setError(formatClientError(err, "Failed to load receipt"));
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, purchaseId, user]);

  useEffect(() => {
    if (!row) return;
    document.title = `DataOnly receipt ${shortId(row.id)}`;
  }, [row]);

  if (loading || !ready) {
    return (
      <section className="page-view">
        <p className="empty-hint">Loading receipt…</p>
      </section>
    );
  }

  if (!configured || !user) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Sign in required</h1>
          <p>Purchase receipts need an account.</p>
          <Link className="primary-button" href={signInHref}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-view">
        <p className="form-error">{error}</p>
        <Link className="text-button" href="/account?tab=purchases">
          Back to Purchases
        </Link>
      </section>
    );
  }

  if (missing || !row) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Receipt not found</h1>
          <p>This receipt is missing or you don&apos;t have access.</p>
          <Link className="primary-button" href="/account?tab=purchases">
            Back to Purchases
          </Link>
        </div>
      </section>
    );
  }

  const license = row.license === "commercial" ? "Commercial License" : "Personal License";
  const statusLabel = row.status === "refunded" ? "Refunded" : "Paid";
  const paymentRef = row.paymentIntentId ? row.paymentIntentId.slice(-8) : null;

  return (
    <section className="page-view receipt-page">
      <div className="receipt-toolbar receipt-no-print">
        <Link className="text-button" href="/account?tab=purchases">
          ← Purchases
        </Link>
        <button type="button" className="primary-button small" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <article className="receipt-sheet">
        <header className="receipt-header">
          <Logo />
          <h1>Purchase receipt</h1>
        </header>

        <dl className="receipt-fields">
          <div>
            <dt>Order</dt>
            <dd>
              {shortId(row.id)}
              <span className="receipt-meta">{row.id}</span>
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatWhen(row.createdAt)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Datacut</dt>
            <dd>{row.title}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{license}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatMoney(row.amountCents, row.currency)}</dd>
          </div>
          <div>
            <dt>Buyer</dt>
            <dd>{buyer}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>DataOnly</dd>
          </div>
          {paymentRef ? (
            <div>
              <dt>Payment ref</dt>
              <dd>…{paymentRef}</dd>
            </div>
          ) : null}
        </dl>

        <p className="receipt-footnote">This is a purchase receipt, not a tax invoice.</p>
      </article>
    </section>
  );
}
