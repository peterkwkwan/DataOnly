"use client";

import type { Datacut } from "@dataonly/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Art } from "@/components/brand";
import { BuyModal } from "@/components/buy-modal";
import { DatacutReviews } from "@/components/datacut-reviews";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { useAuth } from "@/context/auth-context";
import { useSaved } from "@/context/saved-context";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AccessPayload = {
  access: string;
  delivery: {
    mode: string;
    note?: string;
    url?: string;
    expiresIn?: number;
    fileName?: string;
    format: string;
    size: string;
    records: string;
  };
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
  creatorUserId,
}: {
  cut: Datacut;
  creatorSlug?: string;
  creatorVerified: boolean;
  creatorUserId?: string | null;
}) {
  const { isSaved, toggleSaved } = useSaved();
  const { user, configured, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [buyOpen, setBuyOpen] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [liveRating, setLiveRating] = useState(cut.rating);
  const [liveReviews, setLiveReviews] = useState(cut.reviews);
  const [tab, setTab] = useState<"overview" | "reviews">("overview");
  const saved = isSaved(cut.id);
  const verified = creatorVerified || !!cut.creatorVerified;
  const isOwner = !!user && !!creatorUserId && user.id === creatorUserId;
  const hasSample = !!cut.sampleStoragePath?.trim();

  const refreshEntitlement = useCallback(async () => {
    if (!configured || !user) {
      setEntitled(false);
      setAccessRevoked(false);
      return;
    }
    setEntitlementLoading(true);
    try {
      const res = await fetch(`/api/entitlements/check?datacutId=${cut.id}`);
      const data = (await res.json()) as {
        entitled?: boolean;
        reason?: string;
        status?: string;
      };
      setEntitled(!!data.entitled);
      // Refunded → same as never bought (Buy datacut). Only admin-revoked stays locked.
      setAccessRevoked(
        !data.entitled && (data.reason === "revoked" || data.status === "revoked"),
      );
    } catch {
      setEntitled(false);
      setAccessRevoked(false);
    } finally {
      setEntitlementLoading(false);
    }
  }, [configured, cut.id, user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshEntitlement();
  }, [authLoading, refreshEntitlement]);

  // One view per tab session; visitor_key is user id or anon uuid in localStorage.
  useEffect(() => {
    if (!configured || !isSupabaseConfigured()) return;
    const sessionKey = `lpv:${cut.id}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* private mode — still attempt insert once this mount */
    }

    let visitorKey: string | null = user?.id ?? null;
    if (!visitorKey) {
      try {
        const storageKey = "dataonly_visitor_key";
        let existing = localStorage.getItem(storageKey);
        if (!existing) {
          existing = crypto.randomUUID();
          localStorage.setItem(storageKey, existing);
        }
        visitorKey = existing;
      } catch {
        visitorKey = null;
      }
    }

    const supabase = createBrowserSupabaseClient();
    void supabase.from("listing_page_views").insert({
      datacut_id: cut.id,
      visitor_key: visitorKey,
    });
  }, [configured, cut.id, user?.id]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "cancel") {
      setBanner("Checkout canceled — no charge was made.");
      return;
    }
    if (checkout !== "success") return;

    const sessionId = searchParams.get("session_id");
    let cancelled = false;

    async function confirmAndRefresh() {
      setBanner("Payment received. Activating access…");
      if (sessionId?.startsWith("cs_") && configured && user) {
        try {
          const res = await fetch("/api/stripe/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (cancelled) return;
          if (res.ok && data.ok) {
            setBanner("Payment received. Access is active.");
          } else {
            console.error("[checkout confirm]", data.error ?? res.status);
            setBanner(
              "Payment received. Access usually activates within a few seconds — refresh if it doesn’t.",
            );
          }
        } catch (err) {
          console.error("[checkout confirm]", err);
          if (!cancelled) {
            setBanner(
              "Payment received. Access usually activates within a few seconds — refresh if it doesn’t.",
            );
          }
        }
      } else if (!cancelled) {
        setBanner("Payment received. Access usually activates within a few seconds.");
      }
      if (!cancelled) await refreshEntitlement();
    }

    void confirmAndRefresh();
    return () => {
      cancelled = true;
    };
  }, [configured, refreshEntitlement, searchParams, user]);

  async function downloadFile() {
    setAccessError(null);
    setAccessBusy(true);
    try {
      const res = await fetch(`/api/entitlements/access?datacutId=${cut.id}`);
      const data = (await res.json()) as AccessPayload & { error?: string };
      if (!res.ok) {
        setAccessError(data.error ?? "Download denied");
        setAccess(data.access === "granted" ? data : null);
        return;
      }
      setAccess(data);
      if (data.delivery.mode === "signed_url" && data.delivery.url) {
        const anchor = document.createElement("a");
        anchor.href = data.delivery.url;
        anchor.rel = "noopener";
        anchor.download = data.delivery.fileName || "download";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        setAccessError(data.delivery.note ?? "No downloadable file yet");
      }
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setAccessBusy(false);
    }
  }

  async function downloadSample() {
    setSampleError(null);
    setSampleBusy(true);
    try {
      const res = await fetch(`/api/samples/access?datacutId=${cut.id}`);
      const data = (await res.json()) as {
        delivery?: { mode?: string; url?: string; fileName?: string; note?: string };
        error?: string;
      };
      if (!res.ok) {
        setSampleError(data.error ?? "Sample download failed");
        return;
      }
      if (data.delivery?.mode === "signed_url" && data.delivery.url) {
        const anchor = document.createElement("a");
        anchor.href = data.delivery.url;
        anchor.rel = "noopener";
        anchor.download = data.delivery.fileName || "sample";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        setSampleError(data.delivery?.note ?? "No sample file");
      }
    } catch (err) {
      setSampleError(err instanceof Error ? err.message : "Sample download failed");
    } finally {
      setSampleBusy(false);
    }
  }

  async function shareListing() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Copied");
    } catch {
      setShareHint("Copy failed");
    }
    window.setTimeout(() => setShareHint(null), 1600);
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
            <Icon name="star" size={14} filled /> {liveRating} ({liveReviews})
          </span>
          <span className="detail-meta-updated">{cut.updated}</span>
        </div>
        <div className="detail-actions">
          <button
            type="button"
            className="detail-action"
            onClick={() => void shareListing()}
            aria-label={shareHint ?? "Share"}
            title={shareHint ?? "Share"}
          >
            <Icon name="share" size={18} />
          </button>
          <button
            type="button"
            className={`detail-action ${saved ? "saved" : ""}`}
            onClick={() => toggleSaved(cut.id)}
            aria-label={saved ? "Remove from saved" : "Save"}
            title={saved ? "Remove from saved" : "Save"}
          >
            <Icon name="bookmark" size={18} filled={saved} />
          </button>
          {!isOwner ? (
            <ReportButton
              variant="overflow"
              triggerLabel="Options"
              targetType="datacut"
              datacutId={cut.id}
              creatorId={cut.creatorId}
            />
          ) : null}
        </div>
        <p>{cut.description}</p>

        <div className="filter-row dashboard-tabs" role="tablist" aria-label="Datacut sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "overview"}
            className={tab === "overview" ? "active" : undefined}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "reviews"}
            className={tab === "reviews" ? "active" : undefined}
            onClick={() => setTab("reviews")}
          >
            Reviews
          </button>
        </div>

        {tab === "overview" ? (
          <>
            <div className="detail-meta">
              <span>{cut.records} records</span>
              <span>{cut.size}</span>
              <span>{cut.format}</span>
            </div>
            <div className="buy-license">{cut.licenseBlurb}</div>
            <div className="detail-price">${cut.price} USD</div>

            {banner ? <p className="empty-hint">{banner}</p> : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {isOwner ? (
                <Link className="primary-button" href={`/dashboard/listings/${cut.id}`}>
                  Edit listing <Icon name="arrow" size={16} />
                </Link>
              ) : entitled ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={accessBusy}
                  onClick={() => void downloadFile()}
                >
                  {accessBusy ? "Preparing…" : "Download"} <Icon name="arrow" size={16} />
                </button>
              ) : accessRevoked ? (
                <button type="button" className="primary-button" disabled>
                  Access revoked
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
              {hasSample ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={sampleBusy}
                  onClick={() => void downloadSample()}
                >
                  {sampleBusy ? "Preparing…" : "Download sample"}
                </button>
              ) : null}
            </div>

            {accessRevoked && !entitled ? (
              <p className="empty-hint" style={{ marginTop: 12 }}>
                Access to this datacut was revoked. Download is no longer available.
              </p>
            ) : null}

            {sampleError ? <p className="form-error">{sampleError}</p> : null}
            {accessError ? <p className="form-error">{accessError}</p> : null}
            {access ? (
              <div className="buy-license" style={{ marginTop: 16 }}>
                <b>
                  {access.delivery.mode === "signed_url" ? "Download started" : "Access granted"} ·{" "}
                  {access.license.summary.title}
                </b>
                {access.delivery.fileName ? (
                  <p style={{ margin: "8px 0 0" }}>File: {access.delivery.fileName}</p>
                ) : null}
                {access.delivery.note ? (
                  <p style={{ margin: "8px 0 0" }}>{access.delivery.note}</p>
                ) : null}
                <p style={{ margin: "6px 0 0" }}>
                  Format {access.delivery.format} · {access.delivery.size} ·{" "}
                  {access.delivery.records} records · license {access.license.version}
                  {access.delivery.expiresIn
                    ? ` · link expires in ${access.delivery.expiresIn}s`
                    : ""}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <DatacutReviews
            datacutId={cut.id}
            entitled={entitled}
            headerRating={cut.rating}
            headerReviews={cut.reviews}
            onSummaryChange={(summary) => {
              setLiveRating(summary.rating);
              setLiveReviews(summary.count);
            }}
          />
        )}
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
