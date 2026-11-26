"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { ListingRowMenu } from "@/components/listing-row-menu";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, Datacut, ListingStatus } from "@dataonly/core";
import { mapDatacut, mapEntitlement, type DatacutRow, type EntitlementRow } from "@dataonly/core";

const LISTING_PILL_LABELS: Record<ListingStatus, string> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  unpublished: "UNPUBLISHED",
};

type DashboardTab = "listings" | "purchased";

type PurchasedCut = {
  entitlementId: string;
  datacutId: number;
  slug: string;
  title: string;
  license: string;
  hasFile: boolean;
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

function mapPurchasedRow(row: EntitlementRow & { datacuts?: unknown }): PurchasedCut | null {
  const entitlement = mapEntitlement(row);
  if (entitlement.status !== "active") return null;
  const rel = row.datacuts as
    | {
        id: number;
        slug: string;
        title: string;
        storage_path?: string | null;
        file_name?: string | null;
      }
    | {
        id: number;
        slug: string;
        title: string;
        storage_path?: string | null;
        file_name?: string | null;
      }[]
    | null
    | undefined;
  const cut = Array.isArray(rel) ? rel[0] : rel;
  if (!cut) return null;
  const storagePath = typeof cut.storage_path === "string" ? cut.storage_path.trim() : "";
  return {
    entitlementId: entitlement.id,
    datacutId: cut.id,
    slug: cut.slug,
    title: cut.title,
    license: entitlement.license,
    hasFile: !!storagePath,
  };
}

export default function DashboardPage() {
  const { user, profile, loading, configured } = useAuth();
  const [tab, setTab] = useState<DashboardTab>("listings");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [listings, setListings] = useState<Datacut[]>([]);
  const [purchased, setPurchased] = useState<PurchasedCut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  async function handleDownload(cut: PurchasedCut) {
    setDownloadError(null);
    setDownloadId(cut.datacutId);
    try {
      const res = await fetch(`/api/entitlements/access?datacutId=${cut.datacutId}`);
      const data = (await res.json()) as {
        error?: string;
        delivery?: { mode?: string; url?: string; fileName?: string; note?: string };
      };
      if (!res.ok) {
        setDownloadError(data.error ?? "Download denied");
        return;
      }
      if (data.delivery?.mode === "signed_url" && data.delivery.url) {
        const anchor = document.createElement("a");
        anchor.href = data.delivery.url;
        anchor.rel = "noopener";
        anchor.download = data.delivery.fileName || "download";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        setDownloadError(data.delivery?.note ?? data.error ?? "No downloadable file yet");
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadId(null);
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
        const [{ data, error: listError }, { data: entitlementData, error: entitlementError }] =
          await Promise.all([
            supabase
              .from("datacuts")
              .select(
                "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, storage_path, file_name, creators(name, verified), categories(name)",
              )
              .eq("creator_id", ensured.id)
              .order("updated_at", { ascending: false }),
            supabase
              .from("entitlements")
              .select(
                "id, user_id, datacut_id, license, license_version, amount_cents, currency, platform_fee_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_account_id, status, downloaded_at, created_at, updated_at, datacuts(id, slug, title, storage_path, file_name)",
              )
              .eq("user_id", user!.id)
              .eq("status", "active")
              .order("created_at", { ascending: false }),
          ]);
        if (listError) throw listError;
        if (entitlementError) throw entitlementError;
        if (!cancelled) {
          setListings(((data ?? []) as DatacutRow[]).map(mapDatacut));
          setPurchased(
            ((entitlementData ?? []) as (EntitlementRow & { datacuts?: unknown })[])
              .map(mapPurchasedRow)
              .filter((row): row is PurchasedCut => row !== null),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setCreator(null);
          setListings([]);
          setPurchased([]);
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
        <h1 className="dashboard-username">
          {creator?.name ?? "Your store"}
          {creator?.verified ? <Verified /> : null}
        </h1>
        {creator ? (
          <Link className="link-button" href={`/creators/${creator.slug}`}>
            View storefront
          </Link>
        ) : null}
        <p>Draft and publish datacuts, open purchases you own, and manage your storefront.</p>
      </div>

      {error ? <p className="form-error dashboard-inline-error">{error}</p> : null}

      <div className="filter-row dashboard-tabs" role="tablist" aria-label="Dashboard sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "listings"}
          className={tab === "listings" ? "active" : undefined}
          onClick={() => setTab("listings")}
        >
          Listings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "purchased"}
          className={tab === "purchased" ? "active" : undefined}
          onClick={() => setTab("purchased")}
        >
          Purchased datacuts
        </button>
      </div>

      {tab === "listings" ? (
        <>
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
                          {`${
                            cut.license === "commercial"
                              ? "Commercial License"
                              : "Personal License"
                          } · $${cut.price}`}
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
        </>
      ) : (
        <>
          <div className="results-header dashboard-section-toolbar">
            <div>
              <h2>Purchased datacuts</h2>
              <span>{purchased.length}</span>
            </div>
          </div>

          {downloadError ? <p className="form-error dashboard-inline-error">{downloadError}</p> : null}

          <div className="listing-table">
            {error ? (
              <p className="empty-hint">Purchases unavailable until the error above is fixed.</p>
            ) : purchased.length === 0 ? (
              <p className="empty-hint">No purchases yet. Entitled datacuts will show up here.</p>
            ) : (
              purchased.map((cut) => (
                <article key={cut.entitlementId} className="listing-row">
                  <div>
                    <b>
                      <Link href={`/datacuts/${cut.slug}`}>{cut.title}</Link>
                    </b>
                    <span className="listing-row-meta">
                      <span className="status-pill status-pill--approved">OWNED</span>
                      <span className="listing-row-meta-detail">
                        {cut.license === "commercial" ? "Commercial License" : "Personal License"}
                      </span>
                    </span>
                  </div>
                  <div className="listing-row-actions">
                    <button
                      type="button"
                      className="primary-button small"
                      disabled={downloadId === cut.datacutId || !cut.hasFile}
                      title={cut.hasFile ? undefined : "No file uploaded yet"}
                      onClick={() => void handleDownload(cut)}
                    >
                      {downloadId === cut.datacutId ? "Preparing…" : "Download"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
