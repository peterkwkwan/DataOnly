"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { VerificationApplication } from "@dataonly/core";
import { mapVerification, type VerificationRow } from "@dataonly/core";

type QueueItem = VerificationApplication & { creatorName?: string };

export default function AdminVerificationPage() {
  const { user, isAdmin, loading, refreshProfile } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadQueue() {
    const supabase = createBrowserSupabaseClient();
    const { data, error: qError } = await supabase
      .from("verification_applications")
      .select("*, creators(name)")
      .in("status", ["submitted", "under_review", "needs_more_info"])
      .order("submitted_at", { ascending: true });
    if (qError) throw qError;
    setItems(
      ((data ?? []) as (VerificationRow & { creators?: { name: string } | { name: string }[] | null })[]).map(
        (row) => {
          const mapped = mapVerification(row);
          const rel = row.creators;
          const creatorName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
          return { ...mapped, creatorName };
        },
      ),
    );
  }

  useEffect(() => {
    if (loading || !user || !isAdmin || !isSupabaseConfigured()) return;
    void loadQueue().catch((err) => setError(err instanceof Error ? err.message : "Failed to load queue"));
  }, [isAdmin, loading, user]);

  async function act(
    app: QueueItem,
    action: "approve" | "reject" | "request_info" | "under_review",
  ) {
    if (!user) return;
    setBusyId(app.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const reason = note[app.id]?.trim() || null;
      if (action === "reject" && !reason) {
        throw new Error("Rejection reason is required");
      }
      if (action === "request_info" && !reason) {
        throw new Error("Info request note is required");
      }

      const patch: Record<string, unknown> = {
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (action === "approve") {
        patch.status = "approved";
        const { error: creatorError } = await supabase
          .from("creators")
          .update({ verified: true, verified_at: new Date().toISOString(), revoked_at: null })
          .eq("id", app.creatorId);
        if (creatorError) throw creatorError;
      } else if (action === "reject") {
        patch.status = "rejected";
        patch.rejection_reason = reason;
      } else if (action === "request_info") {
        patch.status = "needs_more_info";
        patch.info_request_note = reason;
      } else {
        patch.status = "under_review";
      }

      const { error: updateError } = await supabase
        .from("verification_applications")
        .update(patch)
        .eq("id", app.id);
      if (updateError) throw updateError;
      await loadQueue();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase for the admin queue.</p>
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
        <Link href="/auth/sign-in?next=/admin/verification">Sign in</Link>
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
            editor to open the verification queue.
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
        <h1>Verification queue</h1>
        <p>Approve, request more info, or reject expert applications.</p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="listing-table">
        {items.length === 0 ? (
          <p className="empty-hint">Queue is empty.</p>
        ) : (
          items.map((app) => (
            <article key={app.id} className="listing-row admin-row">
              <div>
                <b>{app.creatorName ?? app.creatorId}</b>
                <span>
                  {app.status} · {app.identity}
                </span>
                <p>{app.industries.join(", ")}</p>
                <ul>
                  {app.portfolioLinks.map((link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
                {app.credentials ? <p>{app.credentials}</p> : null}
                <label>
                  Note / reason
                  <input
                    value={note[app.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [app.id]: e.target.value }))}
                  />
                </label>
              </div>
              <div className="admin-actions">
                <button
                  type="button"
                  className="primary-button small"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "under_review")}
                >
                  Mark reviewing
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "request_info")}
                >
                  Request info
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "reject")}
                >
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
