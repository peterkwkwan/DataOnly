"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { VerificationApplication, VerificationStatus } from "@dataonly/core";
import {
  mapVerification,
  verifiedSourcePlatformLabel,
  type VerificationRow,
} from "@dataonly/core";

type QueueItem = VerificationApplication & { creatorName?: string };

function formatAppliedAt(iso: string | null): string {
  if (!iso) return "Not submitted";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Applied —";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Applied just now";
  if (seconds < 90) return "Applied 1 minute ago";
  if (seconds < 3600) return `Applied ${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 5400) return "Applied 1 hour ago";
  if (seconds < 86400) return `Applied ${Math.round(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "Applied 1 day ago";
  return `Applied ${Math.round(seconds / 86400)} days ago`;
}

function displaySourceUrl(url: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

function statusPillClass(status: VerificationStatus): string {
  return `status-pill status-pill--${status}`;
}

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
    void loadQueue().catch((err) => setError(formatClientError(err, "Failed to load queue")));
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
      setError(formatClientError(err, "Action failed"));
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
        <p>
          Approve, request more info, or reject expert applications.{" "}
          <Link href="/admin/refunds">Refunds</Link>
        </p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="listing-table admin-queue">
        {items.length === 0 ? (
          <p className="empty-hint">Queue is empty.</p>
        ) : (
          items.map((app) => (
            <article key={app.id} className="admin-queue-card">
              <header className="admin-queue-header">
                <div className="admin-queue-identity">
                  <div className="admin-queue-name-row">
                    <b className="admin-queue-name">{app.creatorName ?? app.identity ?? app.creatorId}</b>
                    <span className={statusPillClass(app.status)}>{app.status.toUpperCase()}</span>
                  </div>
                  {app.industries.length > 0 ? (
                    <p className="admin-queue-meta">{app.industries.join(" · ")}</p>
                  ) : null}
                </div>
                <time
                  className="admin-queue-applied"
                  dateTime={app.submittedAt ?? undefined}
                >
                  {formatAppliedAt(app.submittedAt)}
                </time>
              </header>

              <div className="admin-queue-sources" aria-label="Verified sources">
                <span className="admin-queue-section-label">Verified sources</span>
                {app.sources.length > 0 ? (
                  <div className="admin-sources">
                    {app.sources.map((source) => (
                      <a
                        key={`${source.platform}:${source.url}`}
                        className="admin-source-card"
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="admin-source-label">
                          {verifiedSourcePlatformLabel(source.platform)}
                        </span>
                        <span className="admin-source-url">{displaySourceUrl(source.url)}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="empty-hint">No verified sources on this application.</p>
                )}
              </div>

              {app.credentials ? <p className="admin-queue-credentials">{app.credentials}</p> : null}

              <label className="admin-queue-note">
                Note / reason
                <textarea
                  rows={3}
                  placeholder="Optional note for approve, request info, or reject…"
                  value={note[app.id] ?? ""}
                  onChange={(e) => setNote((n) => ({ ...n, [app.id]: e.target.value }))}
                />
              </label>

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
                  className="secondary-button small"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "under_review")}
                >
                  Mark reviewing
                </button>
                <button
                  type="button"
                  className="secondary-button small"
                  disabled={busyId === app.id}
                  onClick={() => void act(app, "request_info")}
                >
                  Request info
                </button>
                <button
                  type="button"
                  className="secondary-button small"
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
