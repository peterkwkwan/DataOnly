"use client";

import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  validateReportInput,
  type ReportReason,
  type ReportTargetType,
} from "@dataonly/core";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { MenuSelect } from "@/components/menu-select";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  targetType: ReportTargetType;
  datacutId?: number | null;
  creatorId?: string | null;
  label?: string;
  /** Shown under/beside the ⋯ trigger when variant is overflow */
  triggerLabel?: string;
  /** text = link button; overflow = ⋯ menu with Report item */
  variant?: "text" | "overflow";
};

const REASON_OPTIONS = REPORT_REASONS.map((r) => ({
  value: r,
  label: REPORT_REASON_LABELS[r],
}));

export function ReportButton({
  targetType,
  datacutId = null,
  creatorId = null,
  label = "Report",
  triggerLabel,
  variant = "text",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("copyright");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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

  function openReport() {
    setMenuOpen(false);
    setOpen(true);
  }

  const trigger =
    variant === "overflow" ? (
      <div className="listing-row-menu detail-report-menu" ref={menuRef}>
        <button
          type="button"
          className={
            triggerLabel ? "detail-action listing-row-menu-trigger" : "listing-row-menu-trigger"
          }
          aria-label={triggerLabel ?? "More actions"}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <Icon name="more" size={18} />
          {triggerLabel ? <span>{triggerLabel}</span> : null}
        </button>
        {menuOpen ? (
          <div
            className="listing-row-menu-panel"
            id={menuId}
            role="menu"
            aria-label={triggerLabel ?? "More actions"}
          >
            <div className="listing-row-menu-items">
              <button
                type="button"
                role="menuitem"
                className="listing-row-menu-item"
                onClick={openReport}
              >
                {label}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        {label}
      </button>
    );

  return (
    <>
      {trigger}
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
                <MenuSelect
                  label="Reason *"
                  value={reason}
                  options={REASON_OPTIONS}
                  onChange={setReason}
                />
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
