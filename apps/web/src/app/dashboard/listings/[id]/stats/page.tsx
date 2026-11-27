"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type StatsPayload = {
  views: number;
  purchases: number;
  revenueCents: number;
  currency: string;
  refundRate: number;
  downloads: number;
  saves: number;
};

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

function formatRate(rate: number): string {
  return `${Math.round((Number(rate) || 0) * 100)}%`;
}

export default function ListingStatsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured()) return;
    let cancelled = false;

    async function load() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: row, error: cutError } = await supabase
          .from("datacuts")
          .select("id, title")
          .eq("id", Number(params.id))
          .maybeSingle();
        if (cutError) throw cutError;
        if (!row) {
          if (!cancelled) {
            setTitle(null);
            setStats(null);
            setReady(true);
          }
          return;
        }
        if (!cancelled) setTitle(String(row.title));

        const res = await fetch(`/api/listings/${params.id}/stats`);
        const data = (await res.json()) as StatsPayload & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load stats");
        }
        if (!cancelled) {
          setStats(data);
          setError(null);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatClientError(err, "Failed to load stats"));
          setReady(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, params.id, user]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase to view listing stats.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <Link href={`/auth/sign-in?next=/dashboard/listings/${params.id}/stats`}>Sign in</Link>
      </section>
    );
  }

  const idle =
    !!stats &&
    stats.views === 0 &&
    stats.purchases === 0 &&
    stats.revenueCents === 0 &&
    stats.refundRate === 0 &&
    stats.downloads === 0 &&
    stats.saves === 0;

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Stats</span>
        <h1>{title ?? (ready ? "Listing" : "Loading…")}</h1>
        <p>All time</p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {!ready && !error ? <p className="empty-hint">Loading…</p> : null}
      {stats ? (
        <>
          <div className="store-stats listing-stats">
            <span>
              <b>{stats.views}</b>
              Views
            </span>
            <span>
              <b>{stats.purchases}</b>
              Purchases
            </span>
            <span>
              <b>{formatMoney(stats.revenueCents, stats.currency)}</b>
              Revenue
            </span>
            <span>
              <b>{formatRate(stats.refundRate)}</b>
              Refund rate
            </span>
            <span>
              <b>{stats.downloads}</b>
              Downloads
            </span>
            <span>
              <b>{stats.saves}</b>
              Saves
            </span>
          </div>
          {idle ? <p className="empty-hint">No activity yet.</p> : null}
        </>
      ) : null}
      {ready && !stats ? (
        <p className="empty-hint">
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      ) : null}
      {stats ? (
        <p className="empty-hint">
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
      ) : null}
    </section>
  );
}
