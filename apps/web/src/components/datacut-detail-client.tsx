"use client";

import type { Datacut } from "@dataonly/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Art } from "@/components/brand";
import { BuyModal } from "@/components/buy-modal";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";
import { useSaved } from "@/context/saved-context";

type AccessPayload = {
  access: string;
  delivery: { mode: string; note: string; format: string; size: string; records: string };
  license: {
    template: string;
    version: string;
    summary: { title: string; allows: string; forbids: string };
  };
};

export function DatacutDetailClient({
  cut,
  creatorSlug,
  creatorVerified,
}: {
  cut: Datacut;
  creatorSlug?: string;
  creatorVerified: boolean;
}) {
  const { isSaved, toggleSaved } = useSaved();
  const { user, configured, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [buyOpen, setBuyOpen] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const saved = isSaved(cut.id);
  const verified = creatorVerified || !!cut.creatorVerified;

  const refreshEntitlement = useCallback(async () => {
    if (!configured || !user) {
      setEntitled(false);
      return;
    }
    setEntitlementLoading(true);
    try {
      const res = await fetch(`/api/entitlements/check?datacutId=${cut.id}`);
      const data = (await res.json()) as { entitled?: boolean };
      setEntitled(!!data.entitled);
    } catch {
      setEntitled(false);
    } finally {
      setEntitlementLoading(false);
    }
  }, [configured, cut.id, user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshEntitlement();
  }, [authLoading, refreshEntitlement]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setBanner("Payment received. Entitlement activates when the Stripe webhook lands (usually seconds).");
      void refreshEntitlement();
    } else if (checkout === "cancel") {
      setBanner("Checkout canceled — no charge was made.");
    }
  }, [refreshEntitlement, searchParams]);

  async function openAccess() {
    setAccessError(null);
    setAccessBusy(true);
    try {
      const res = await fetch(`/api/entitlements/access?datacutId=${cut.id}`);
      const data = await res.json();
      if (!res.ok) {
        setAccessError(data.error ?? "Access denied");
        setAccess(null);
        return;
      }
      setAccess(data as AccessPayload);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Access failed");
    } finally {
      setAccessBusy(false);
    }
  }

  return (
    <div className="detail-layout">
      <div className="detail-art" style={{ background: cut.accent }}>
        <Art type={cut.art} />
      </div>
      <div className="detail-panel">
        <span className="kicker">{cut.categoryName}</span>
        <h1>{cut.title}</h1>
        <div className="detail-meta">
          <Link
            href={creatorSlug ? `/creators/${creatorSlug}` : "/creators"}
            className="creator-name detail-creator-name"
          >
            {cut.creatorName}
            {verified ? <Icon name="shield" size={13} /> : null}
          </Link>
          <span>
            <Icon name="star" size={14} filled /> {cut.rating} ({cut.reviews})
          </span>
          <span>{cut.updated}</span>
        </div>
        <p>{cut.description}</p>
        <div className="detail-meta">
          <span>{cut.records} records</span>
          <span>{cut.size}</span>
          <span>{cut.format}</span>
        </div>
        <div className="buy-license">{cut.licenseBlurb}</div>
        <div className="detail-price">${cut.price} USD</div>

        {banner ? <p className="empty-hint">{banner}</p> : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {entitled ? (
            <button
              type="button"
              className="primary-button"
              disabled={accessBusy}
              onClick={() => void openAccess()}
            >
              {accessBusy ? "Opening…" : "Open access"} <Icon name="arrow" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={entitlementLoading}
              onClick={() => setBuyOpen(true)}
            >
              Buy datacut <Icon name="arrow" size={16} />
            </button>
          )}
          <button
            type="button"
            className={`icon-button ${saved ? "saved" : ""}`}
            onClick={() => toggleSaved(cut.id)}
            aria-label="Save"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              width: "auto",
              padding: "0 14px",
              gap: 8,
              display: "inline-flex",
            }}
          >
            <Icon name="bookmark" size={18} filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        {accessError ? <p className="form-error">{accessError}</p> : null}
        {access ? (
          <div className="buy-license" style={{ marginTop: 16 }}>
            <b>Access granted · {access.license.summary.title}</b>
            <p style={{ margin: "8px 0 0" }}>{access.delivery.note}</p>
            <p style={{ margin: "6px 0 0" }}>
              Format {access.delivery.format} · {access.delivery.size} · {access.delivery.records}{" "}
              records · license {access.license.version}
            </p>
          </div>
        ) : null}
      </div>
      <BuyModal
        cut={cut}
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        entitled={entitled}
      />
    </div>
  );
}
