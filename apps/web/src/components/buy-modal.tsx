"use client";

import type { Datacut } from "@dataonly/core";
import { LICENSE_SUMMARIES, LICENSE_TEMPLATE_VERSION } from "@dataonly/core";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";

export function BuyModal({
  cut,
  open,
  onClose,
  entitled,
}: {
  cut: Datacut;
  open: boolean;
  onClose: () => void;
  entitled?: boolean;
}) {
  const { user, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = LICENSE_SUMMARIES[cut.license];

  if (!open) return null;

  async function startCheckout() {
    setError(null);
    if (!configured) {
      setError("Connect Supabase and sign in before purchasing.");
      return;
    }
    if (!user) {
      setError("Sign in required to purchase.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datacutId: cut.id }),
      });
      const raw = await res.text();
      let data: { url?: string; error?: string; code?: string } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setError(
            res.ok
              ? "Checkout returned an invalid response"
              : `Checkout failed (${res.status})`,
          );
          return;
        }
      } else if (!res.ok) {
        setError(`Checkout failed (${res.status})`);
        return;
      }
      if (!res.ok) {
        if (data.code === "stripe_not_configured") {
          setError(
            "Stripe keys are not set yet. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY (see README).",
          );
        } else if (data.code === "creator_not_onboarded") {
          setError(data.error ?? "Creator payouts are not set up yet.");
        } else if (data.code === "already_entitled") {
          setError("You already own this datacut.");
        } else {
          setError(data.error ?? `Checkout failed (${res.status})`);
        }
        return;
      }
      if (!data.url) {
        setError("Checkout session missing redirect URL");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="buy-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="buy-title">
      <div className="buy-modal">
        <button type="button" className="buy-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        <span className="kicker">{entitled ? "Owned" : "Checkout"}</span>
        <h2 id="buy-title">{entitled ? "You own this datacut" : "Review license & pay"}</h2>
        <p>
          <strong>{cut.title}</strong> — ${cut.price} USD
        </p>

        <div className="buy-license" aria-label="License summary">
          <b>
            {summary.title} · template {LICENSE_TEMPLATE_VERSION}
          </b>
          <p style={{ margin: "8px 0 0" }}>
            <b>Allows:</b> {summary.allows}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <b>Forbids:</b> {summary.forbids}
          </p>
          <p className="empty-hint" style={{ marginTop: 10 }}>
            Full template text will be linked when counsel finalizes copy. This summary is shown
            before pay and pinned on your entitlement.
          </p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="buy-modal-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {entitled ? (
            <button type="button" className="primary-button" onClick={onClose}>
              Close
            </button>
          ) : !user ? (
            <Link className="primary-button" href={`/auth/sign-in?next=/datacuts/${cut.slug}`}>
              Sign in to buy <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void startCheckout()}
            >
              {busy ? "Redirecting…" : "Pay with Stripe"} <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
