"use client";

import {
  REPORT_REASON_LABELS,
  mapReport,
  type Report,
  type ReportReason,
  type ReportRow,
  type ReportStatus,
} from "@dataonly/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type QueueItem = Report & {
  datacutTitle?: string;
  creatorName?: string;
};

const OPEN_STATUSES: ReportStatus[] = ["open", "under_review", "escalate"];

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function statusPillClass(status: ReportStatus): string {
  if (status === "open") return "status-pill status-pill--submitted";
  if (status === "under_review") return "status-pill status-pill--under_review";
  if (status === "escalate") return "status-pill status-pill--needs_more_info";
  if (status === "removed") return "status-pill status-pill--rejected";
  return "status-pill status-pill--approved";
}

function relName(
  rel: { name?: string; title?: string } | { name?: string; title?: string }[] | null | undefined,
  key: "name" | "title",
): string | undefined {
  if (!rel) return undefined;
  const row = Array.isArray(rel) ? rel[0] : rel;
  const value = row?.[key]?.trim();
  return value || undefined;
}

export default function AdminReportsPage() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<string>("all");

  const loadQueue = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    let query = supabase
      .from("reports")
      .select("*, datacuts(title), creators(name)")
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: true });
    if (filterReason !== "all") {
      query = query.eq("reason", filterReason);
    }
    const { data, error: qError } = await query;
    if (qError) throw qError;
    setItems(
      (
        (data ?? []) as (ReportRow & {
          datacuts?: { title?: string } | { title?: string }[] | null;
          creators?: { name?: string } | { name?: string }[] | null;
        })[]
      ).map((row) => {
        const mapped = mapReport(row);
        return {
          ...mapped,
          datacutTitle: relName(row.datacuts, "title"),
          creatorName: relName(row.creators, "name"),
        };
      }),
    );
  }, [filterReason]);

  useEffect(() => {
    if (loading || !user || !isAdmin || !isSupabaseConfigured()) return;
    void loadQueue().catch((err) => setError(formatClientError(err, "Failed to load reports")));
  }, [isAdmin, loading, loadQueue, user]);

  async function patchReport(
    report: QueueItem,
    status: ReportStatus,
    extras: { forceUnpublish?: boolean; hideCreator?: boolean } = {},
  ) {
    if (!user) return;
    setBusyId(report.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const outcome = note[report.id]?.trim() || null;

      if (extras.forceUnpublish && report.datacutId != null) {
        const { error: cutError } = await supabase
          .from("datacuts")
          .update({ status: "unpublished", updated_at: new Date().toISOString() })
          .eq("id", report.datacutId);
        if (cutError) throw cutError;
      }

      if (extras.hideCreator && report.creatorId) {
        const { error: creatorError } = await supabase
          .from("creators")
          .update({ hidden: true, updated_at: new Date().toISOString() })
          .eq("id", report.creatorId);
        if (creatorError) throw creatorError;
      }

      // Takedown on a creator report: unpublish all their live listings
      if (extras.forceUnpublish && report.targetType === "creator" && report.creatorId) {
        const { error: bulkError } = await supabase
          .from("datacuts")
          .update({ status: "unpublished", updated_at: new Date().toISOString() })
          .eq("creator_id", report.creatorId)
          .eq("status", "published");
        if (bulkError) throw bulkError;
      }

      const { error: updateError } = await supabase
        .from("reports")
        .update({
          status,
          outcome_note: outcome,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id);
      if (updateError) throw updateError;
      await loadQueue();
    } catch (err) {
      setError(formatClientError(err, "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase for the reports queue.</p>
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
        <Link href="/auth/sign-in?next=/admin/reports">Sign in</Link>
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
            editor to open the reports queue.
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
        <h1>Reports queue</h1>
        <p>
          Review buyer/visitor reports. Urgent path force-unpublishes while investigating;
          entitlements history is not deleted.{" "}
          <Link href="/admin/verification">Verification</Link>
          {" · "}
          <Link href="/admin/refunds">Refunds</Link>
        </p>
      </div>

      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        Reason
        <select
          value={filterReason}
          onChange={(e) => setFilterReason(e.target.value)}
        >
          <option value="all">All</option>
          {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
            <option key={r} value={r}>
              {REPORT_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="listing-table admin-queue">
        {items.length === 0 ? (
          <p className="empty-hint">Queue is empty.</p>
        ) : (
          items.map((report) => {
            const targetLabel =
              report.targetType === "datacut"
                ? report.datacutTitle ?? `Datacut #${report.datacutId}`
                : report.creatorName ?? report.creatorId ?? "Creator";
            return (
              <article key={report.id} className="admin-queue-card">
                <header className="admin-queue-header">
                  <div className="admin-queue-identity">
                    <div className="admin-queue-name-row">
                      <b className="admin-queue-name">{targetLabel}</b>
                      <span className={statusPillClass(report.status)}>
                        {report.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="admin-queue-meta">
                      {report.targetType} · {REPORT_REASON_LABELS[report.reason]}
                      {report.creatorName && report.targetType === "datacut"
                        ? ` · ${report.creatorName}`
                        : ""}
                    </p>
                  </div>
                  <time className="admin-queue-applied" dateTime={report.createdAt}>
                    {formatWhen(report.createdAt)}
                  </time>
                </header>

                {report.details ? (
                  <p className="admin-queue-credentials">{report.details}</p>
                ) : (
                  <p className="empty-hint">No details provided.</p>
                )}
                {report.reporterEmail ? (
                  <p className="admin-queue-meta">Reporter: {report.reporterEmail}</p>
                ) : null}

                <label className="admin-queue-note">
                  Outcome note
                  <textarea
                    rows={2}
                    placeholder="Optional audit note…"
                    value={note[report.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [report.id]: e.target.value }))}
                  />
                </label>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="secondary-button small"
                    disabled={busyId === report.id}
                    onClick={() => void patchReport(report, "under_review")}
                  >
                    Mark reviewing
                  </button>
                  <button
                    type="button"
                    className="primary-button small"
                    disabled={busyId === report.id}
                    onClick={() =>
                      void patchReport(report, "under_review", {
                        forceUnpublish: true,
                      })
                    }
                    title="Unpublish content now; keep investigating"
                  >
                    Force unpublish
                  </button>
                  {report.creatorId ? (
                    <button
                      type="button"
                      className="secondary-button small"
                      disabled={busyId === report.id}
                      onClick={() =>
                        void patchReport(report, "under_review", {
                          forceUnpublish: true,
                          hideCreator: true,
                        })
                      }
                      title="Unpublish + hide creator storefront"
                    >
                      Hide creator
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-button small"
                    disabled={busyId === report.id}
                    onClick={() =>
                      void patchReport(report, "removed", { forceUnpublish: true })
                    }
                  >
                    Confirm removed
                  </button>
                  <button
                    type="button"
                    className="secondary-button small"
                    disabled={busyId === report.id}
                    onClick={() => void patchReport(report, "no_action")}
                  >
                    No action
                  </button>
                  <button
                    type="button"
                    className="secondary-button small"
                    disabled={busyId === report.id}
                    onClick={() => void patchReport(report, "escalate")}
                  >
                    Escalate
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
