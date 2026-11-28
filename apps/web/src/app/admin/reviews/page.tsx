"use client";

import type { Review } from "@dataonly/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type QueueItem = Review & { datacutTitle?: string };

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export default function AdminReviewsPage() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: qError } = await supabase
      .from("reviews")
      .select("id, user_id, datacut_id, rating, body, visible, created_at, updated_at, datacuts(title)")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (qError) throw qError;
    setItems(
      (
        (data ?? []) as {
          id: string;
          user_id: string;
          datacut_id: number;
          rating: number;
          body: string | null;
          visible: boolean;
          created_at: string;
          updated_at: string;
          datacuts?: { title?: string } | { title?: string }[] | null;
        }[]
      ).map((row) => {
        const rel = row.datacuts;
        const titleRow = Array.isArray(rel) ? rel[0] : rel;
        return {
          id: row.id,
          userId: row.user_id,
          datacutId: Number(row.datacut_id),
          rating: Number(row.rating),
          body: row.body,
          visible: !!row.visible,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          datacutTitle: titleRow?.title?.trim() || undefined,
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (!user || !isAdmin || !isSupabaseConfigured()) return;
    void loadQueue().catch((err) => setError(formatClientError(err, "Failed to load reviews")));
  }, [user, isAdmin, loadQueue]);

  async function hideReview(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visible: false }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Hide failed");
      await loadQueue();
    } catch (err) {
      setError(formatClientError(err, "Hide failed"));
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Connect Supabase</h1>
          <p>Admin reviews need Supabase configured.</p>
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
        <Link href="/auth/sign-in?next=/admin/reviews">Sign in</Link>
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
            editor to moderate reviews.
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
        <h1>Reviews</h1>
        <p>
          Recent visible purchaser ratings. Hide removes them from the product page and drops
          aggregates.{" "}
          <Link href="/admin/verification">Verification</Link>
          {" · "}
          <Link href="/admin/refunds">Refunds</Link>
          {" · "}
          <Link href="/admin/reports">Reports</Link>
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="listing-table admin-queue">
        {items.length === 0 ? (
          <p className="empty-hint">No visible reviews.</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="admin-queue-card">
              <div className="admin-queue-header">
                <div>
                  <div className="admin-queue-name-row">
                    <span>
                      <Icon name="star" size={14} filled /> {item.rating}
                    </span>
                    <strong className="admin-queue-name">
                      {item.datacutTitle ?? `Datacut #${item.datacutId}`}
                    </strong>
                  </div>
                  <p className="admin-queue-meta">{formatWhen(item.createdAt)}</p>
                  {item.body ? <p className="admin-queue-note">{item.body}</p> : null}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyId === item.id}
                  onClick={() => void hideReview(item.id)}
                >
                  {busyId === item.id ? "Hiding…" : "Hide"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
