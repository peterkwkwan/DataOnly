"use client";

import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  validateReportInput,
  type ReportReason,
  type ReportTargetType,
} from "@dataonly/core";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  targetType: ReportTargetType;
  datacutId?: number | null;
  creatorId?: string | null;
  label?: string;
};

export function ReportButton({
  targetType,
  datacutId = null,
  creatorId = null,
  label = "Report",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("copyright");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isSupabaseConfigured()) return null;

  async function submit() {
    setError(null);
    const check = validateReportInput({
      targetType,
      datacutId,
      creatorId,
      reason,
      details,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: insertError } = await supabase.from("reports").insert({
        target_type: targetType,
        datacut_id: targetType === "datacut" ? datacutId : null,
        creator_id: creatorId,
        reason,
        details: details.trim(),
        reporter_id: user?.id ?? null,
        reporter_email: (user?.email ?? email.trim()) || null,
        status: "open",
      });
      if (insertError) throw insertError;
      setDone(true);
    } catch (err) {
      setError(formatClientError(err, "Couldn't submit report"));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(false);
    setError(null);
    setDetails("");
    setReason("copyright");
  }

  return (
    <>
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div
          className="buy-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <div className="buy-modal">
            <button type="button" className="buy-modal-close" onClick={close} aria-label="Close">
              ×
            </button>
            {done ? (
              <>
                <h2 id="report-modal-title">Report received</h2>
                <p>Thanks — our team will review this shortly.</p>
                <div className="buy-modal-actions">
                  <button type="button" className="primary-button" onClick={close}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="report-modal-title">
                  Report {targetType === "datacut" ? "datacut" : "creator"}
                </h2>
                <p className="form-footnote">
                  Flag copyright, privacy, prohibited, or spam issues. Not legal advice — we may
                  unpublish while investigating.
                </p>
                <label>
                  Reason *
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {REPORT_REASON_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Details
                  <textarea
                    rows={4}
                    maxLength={4000}
                    placeholder="Optional context (links, what you saw)…"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </label>
                {!user ? (
                  <label>
                    Email (optional)
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="So we can follow up"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                ) : null}
                {error ? <p className="form-error">{error}</p> : null}
                <div className="buy-modal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy}
                    onClick={() => void submit()}
                  >
                    {busy ? "Sending…" : "Submit report"}
                  </button>
                  <button type="button" className="text-button" onClick={close} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
