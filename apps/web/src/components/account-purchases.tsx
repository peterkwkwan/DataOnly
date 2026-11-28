"use client";

import {
  isCurrentAccessCharge,
  purchaseStatusPills,
  refundBuyerCopy,
  type RefundEligibilityInput,
} from "@dataonly/core";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MenuSelect } from "@/components/menu-select";
import {
  formatCardExpiry,
  parseDeviceCard,
  type DeviceCard,
} from "@/lib/device-payment-method";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type PayoutStatus =
  | "unavailable"
  | "not_started"
  | "incomplete"
  | "pending"
  | "active"
  | "needs_update"
  | "error";

const PAYOUT_PILL_LABELS: Record<PayoutStatus, string> = {
  unavailable: "UNAVAILABLE",
  not_started: "NOT STARTED",
  incomplete: "INCOMPLETE",
  pending: "PENDING",
  active: "ACTIVE",
  needs_update: "NEEDS UPDATE",
  error: "ERROR",
};

type ConnectState = {
  configured: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  requirementsPastDue: boolean;
};

function payoutStatusFromConnect(connect: ConnectState): PayoutStatus {
  if (!connect.configured) return "unavailable";
  if (!connect.accountId) return "not_started";
  if (connect.requirementsPastDue) return "needs_update";
  if (connect.onboardingComplete) return "active";
  if (connect.detailsSubmitted && !connect.chargesEnabled) return "pending";
  return "incomplete";
}

function payoutStatusPill(
  connect: ConnectState | null,
  connectFailed: boolean,
): { label: string; status: PayoutStatus | "loading"; helper: string | null } {
  if (connectFailed && !connect) {
    return {
      label: PAYOUT_PILL_LABELS.error,
      status: "error",
      helper: "Couldn't load payout status. Try again.",
    };
  }
  if (!connect) return { label: "…", status: "loading", helper: null };
  const status = payoutStatusFromConnect(connect);
  const helpers: Record<PayoutStatus, string> = {
    unavailable: "Payouts aren't available right now.",
    not_started: "Finish setup to receive payouts.",
    incomplete: "Finish setup to receive payouts.",
    pending: "Stripe is reviewing your payout details.",
    active: "You can receive sales.",
    needs_update: "Update your payout details to keep receiving sales.",
    error: "Couldn't load payout status. Try again.",
  };
  return { label: PAYOUT_PILL_LABELS[status], status, helper: helpers[status] };
}

function payoutStatusPillClass(status: PayoutStatus | "loading"): string {
  if (status === "loading") return "status-pill status-pill--draft";
  if (status === "unavailable" || status === "error") return "status-pill status-pill--rejected";
  if (status === "not_started") return "status-pill status-pill--draft";
  if (status === "incomplete") return "status-pill status-pill--submitted";
  if (status === "pending") return "status-pill status-pill--under_review";
  if (status === "active") return "status-pill status-pill--approved";
  return "status-pill status-pill--needs_more_info";
}

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

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentMethodKey(userId: string): string {
  return `dataonly.paymentMethod.${userId}`;
}

function readDeviceCard(userId: string): DeviceCard | null {
  try {
    const raw = localStorage.getItem(paymentMethodKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceCard>;
    if (!parsed || typeof parsed.brand !== "string" || typeof parsed.last4 !== "string") return null;
    const expMonth = Number(parsed.expMonth);
    const expYear = Number(parsed.expYear);
    if (!Number.isFinite(expMonth) || !Number.isFinite(expYear)) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      brand: parsed.brand,
      last4: parsed.last4,
      expMonth,
      expYear,
    };
  } catch {
    return null;
  }
}

type HistoryEntitlement = {
  status: string;
  downloadedAt: string | null;
  paymentIntentId: string | null;
};

type HistoryRow = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  license: string;
  createdAt: string;
  refundRequestedAt: string | null;
  refundRequestNote: string | null;
  paymentIntentId: string | null;
  datacutId: number;
  title: string;
  slug: string | null;
  entitlement: HistoryEntitlement | null;
};

function oneRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function eligibilityInput(row: HistoryRow): RefundEligibilityInput {
  const current = isCurrentAccessCharge(
    row.paymentIntentId,
    row.entitlement?.paymentIntentId,
  );
  return {
    purchaseStatus: row.status,
    purchaseCreatedAt: row.createdAt,
    paymentIntentId: row.paymentIntentId,
    refundRequestedAt: row.refundRequestedAt,
    isCurrentAccessCharge: current,
    entitlementStatus: row.entitlement?.status ?? null,
    entitlementDownloadedAt: row.entitlement?.downloadedAt ?? null,
  };
}

function HelpDialog({
  row,
  onClose,
  onRequested,
}: {
  row: HistoryRow;
  onClose: () => void;
  onRequested: (purchaseId: string, at: string, note: string | null) => void;
}) {
  const [reason, setReason] = useState<"refund" | "other">("refund");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const input = eligibilityInput(
    sentAt ? { ...row, refundRequestedAt: sentAt } : row,
  );
  const requestedWhen = formatWhen(sentAt || row.refundRequestedAt || "");
  const copy = refundBuyerCopy(input, requestedWhen === "—" ? "" : requestedWhen);

  async function submit() {
    if (note.trim().length > 500) {
      setNoteError("Keep the note under 500 characters.");
      return;
    }
    setNoteError(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: row.id,
          note: note.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        alreadyRequested?: boolean;
        refundRequestedAt?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the request");
      const at =
        typeof data.refundRequestedAt === "string"
          ? data.refundRequestedAt
          : new Date().toISOString();
      setSentAt(at);
      onRequested(row.id, at, data.alreadyRequested ? row.refundRequestNote : note.trim() || null);
    } catch (err) {
      setError(formatClientError(err, "Couldn't send the request"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="buy-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-help-title"
    >
      <div className="buy-modal">
        <button type="button" className="buy-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="purchase-help-title">I need help with this datacut</h2>
        <p>
          <b>{row.title}</b>
          <br />
          {formatMoney(row.amountCents, row.currency)} · {formatWhen(row.createdAt)}
        </p>
        {sentAt ? (
          copy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        ) : (
          <>
            <MenuSelect
              label="What do you need?"
              value={reason}
              options={[
                { value: "refund", label: "I'd like a refund" },
                { value: "other", label: "Something else" },
              ]}
              onChange={setReason}
            />
            {reason === "other" ? (
              <p>
                Other help isn&apos;t available on this page yet. Choose I&apos;d like a refund if
                that&apos;s what you need.
              </p>
            ) : (
              <>
                {copy.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {copy.canSubmit ? (
                  <label>
                    Anything we should know? (optional)
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        setNoteError(null);
                      }}
                    />
                  </label>
                ) : null}
                {noteError ? <p className="form-error">{noteError}</p> : null}
                {error ? <p className="form-error">{error}</p> : null}
                {copy.canSubmit ? (
                  <div className="buy-modal-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy}
                      onClick={() => void submit()}
                    >
                      {busy ? "Sending…" : "Submit request"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PaymentMethod({ userId }: { userId: string }) {
  const [card, setCard] = useState<DeviceCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCard(readDeviceCard(userId));
    setEditing(false);
    setName("");
    setNumber("");
    setExpiry("");
    setCvc("");
    setError(null);
  }, [userId]);

  function clearForm() {
    setName("");
    setNumber("");
    setExpiry("");
    setCvc("");
    setError(null);
    setEditing(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseDeviceCard({ name, number, expiry, cvc });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    try {
      localStorage.setItem(paymentMethodKey(userId), JSON.stringify(parsed.card));
    } catch {
      setError("Couldn't save the card on this device.");
      return;
    }
    setCard(parsed.card);
    clearForm();
  }

  function remove() {
    if (!window.confirm("Remove this card from this device?")) return;
    try {
      localStorage.removeItem(paymentMethodKey(userId));
    } catch {
      setError("Couldn't save the card on this device.");
      return;
    }
    setCard(null);
    clearForm();
  }

  return (
    <section className="dashboard-verification-card" aria-labelledby="account-payment-heading">
      <div className="results-header dashboard-section-toolbar">
        <div>
          <h2 id="account-payment-heading">Payment method</h2>
        </div>
        {!editing && card ? (
          <div className="dashboard-section-actions">
            <button type="button" className="primary-button small" onClick={() => setEditing(true)}>
              Replace card
            </button>
            <button type="button" className="text-button" onClick={remove}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <form className="payment-method-form" autoComplete="off" onSubmit={save}>
          <label>
            Name on card
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Card number
            <input
              inputMode="numeric"
              autoComplete="off"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </label>
          <label>
            Expiry (MM/YY)
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/YY"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
            />
          </label>
          <label>
            CVC
            <input
              inputMode="numeric"
              autoComplete="off"
              value={cvc}
              onChange={(event) => setCvc(event.target.value)}
            />
          </label>
          <p className="form-footnote">
            Preview only. Checkout still uses Stripe. The full card number and CVC are not saved.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="dashboard-actions">
            <button type="submit" className="primary-button small">
              Save card
            </button>
            <button type="button" className="text-button" onClick={clearForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : card ? (
        <>
          <p>
            {card.brand} ending in {card.last4} · Expires{" "}
            {formatCardExpiry(card.expMonth, card.expYear)}
          </p>
          {error ? <p className="form-error">{error}</p> : null}
        </>
      ) : (
        <>
          <p className="empty-hint">No card saved on this device.</p>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="button" className="primary-button small" onClick={() => setEditing(true)}>
            Add card
          </button>
        </>
      )}
    </section>
  );
}

export function PurchaseHistory({ userId }: { userId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const [purchasesResult, entitlementsResult] = await Promise.all([
      supabase
        .from("purchases")
        .select(
          "id, status, amount_cents, currency, license, created_at, refund_requested_at, refund_request_note, stripe_payment_intent_id, datacut_id, datacuts(title, slug)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("entitlements")
        .select("datacut_id, status, downloaded_at, stripe_payment_intent_id")
        .eq("user_id", userId),
    ]);
    if (purchasesResult.error) throw purchasesResult.error;
    if (entitlementsResult.error) throw entitlementsResult.error;

    const entitlements = new Map<number, HistoryEntitlement>();
    for (const row of entitlementsResult.data ?? []) {
      entitlements.set(Number(row.datacut_id), {
        status: String(row.status),
        downloadedAt: typeof row.downloaded_at === "string" ? row.downloaded_at : null,
        paymentIntentId:
          typeof row.stripe_payment_intent_id === "string" ? row.stripe_payment_intent_id : null,
      });
    }

    setRows(
      (purchasesResult.data ?? []).map((row) => {
        const cut = oneRel(
          row.datacuts as { title?: string; slug?: string } | { title?: string; slug?: string }[] | null,
        );
        const datacutId = Number(row.datacut_id);
        const slug = cut?.slug?.trim() || null;
        return {
          id: String(row.id),
          status: String(row.status),
          amountCents: Number(row.amount_cents) || 0,
          currency: String(row.currency || "usd"),
          license: String(row.license || "personal"),
          createdAt: String(row.created_at),
          refundRequestedAt:
            typeof row.refund_requested_at === "string" ? row.refund_requested_at : null,
          refundRequestNote:
            typeof row.refund_request_note === "string" ? row.refund_request_note : null,
          paymentIntentId:
            typeof row.stripe_payment_intent_id === "string" ? row.stripe_payment_intent_id : null,
          datacutId,
          title: cut?.title?.trim() || `Datacut #${datacutId}`,
          slug,
          entitlement: entitlements.get(datacutId) ?? null,
        };
      }),
    );
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    void load()
      .catch((err) => {
        if (!cancelled) setError(formatClientError(err, "Failed to load purchases"));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openRow = rows.find((row) => row.id === openId) ?? null;

  return (
    <section className="dashboard-verification-card" aria-labelledby="account-history-heading">
      <div className="results-header dashboard-section-toolbar">
        <div>
          <h2 id="account-history-heading">Purchase history</h2>
        </div>
      </div>
      {error ? (
        <>
          <p className="form-error">{error}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError(null);
              setReady(false);
              void load()
                .catch((err) => setError(formatClientError(err, "Failed to load purchases")))
                .finally(() => setReady(true));
            }}
          >
            Retry
          </button>
        </>
      ) : !ready ? (
        <p className="empty-hint">Loading purchases…</p>
      ) : rows.length === 0 ? (
        <p className="empty-hint">No purchases yet.</p>
      ) : (
        <div className="listing-table">
          {rows.map((row) => {
            const input = eligibilityInput(row);
            const pills = purchaseStatusPills({
              purchaseStatus: row.status,
              refundRequestedAt: row.refundRequestedAt,
              isCurrentAccessCharge: input.isCurrentAccessCharge,
              entitlementStatus: input.entitlementStatus,
            });
            const license =
              row.license === "commercial" ? "Commercial License" : "Personal License";
            return (
              <article key={row.id} className="listing-row">
                <div>
                  <b>
                    {row.slug ? (
                      <Link href={`/datacuts/${row.slug}`}>{row.title}</Link>
                    ) : (
                      row.title
                    )}
                  </b>
                  <span className="listing-row-meta">
                    {pills.map((pill) => (
                      <span key={pill.label} className={`status-pill status-pill--${pill.modifier}`}>
                        {pill.label}
                      </span>
                    ))}
                    <span className="listing-row-meta-detail">
                      {license} · {formatMoney(row.amountCents, row.currency)} ·{" "}
                      {formatWhen(row.createdAt)}
                    </span>
                  </span>
                </div>
                <div className="listing-row-actions">
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Options for ${row.title}`}
                    onClick={() => setOpenId(row.id)}
                  >
                    Options
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {openRow ? (
        <HelpDialog
          key={openRow.id}
          row={openRow}
          onClose={() => setOpenId(null)}
          onRequested={(purchaseId, at, note) => {
            setRows((current) =>
              current.map((row) =>
                row.id === purchaseId
                  ? { ...row, refundRequestedAt: at, refundRequestNote: note }
                  : row,
              ),
            );
          }}
        />
      ) : null}
    </section>
  );
}

export function AccountPurchases({
  userId,
  connectQuery,
  accountReady,
}: {
  userId: string;
  connectQuery: string | null;
  /** True after the account tab's creator load settles, so payouts don't create a second creator. */
  accountReady: boolean;
}) {
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [connectFailed, setConnectFailed] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectReady, setConnectReady] = useState(false);

  const refreshConnectStatus = useCallback(async (sync = false) => {
    try {
      const res = await fetch("/api/stripe/connect/status", {
        method: sync ? "POST" : "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load payout status");
      setConnectFailed(false);
      setConnect({
        configured: !!data.configured,
        accountId: data.accountId ?? null,
        chargesEnabled: !!data.chargesEnabled,
        detailsSubmitted: !!data.detailsSubmitted,
        onboardingComplete: !!data.onboardingComplete,
        requirementsPastDue: !!data.requirementsPastDue,
      });
    } catch (err) {
      setConnectFailed(true);
      setConnectMsg("Couldn't load payout status. Try again.");
      console.error("[account payouts]", formatClientError(err, "Could not load payout status"));
    }
  }, []);

  useEffect(() => {
    if (!accountReady) return;
    let cancelled = false;
    async function load() {
      try {
        await refreshConnectStatus(true);
        if (cancelled) return;
        if (connectQuery === "return") setConnectMsg("Payout settings updated.");
        else if (connectQuery === "refresh") {
          setConnectMsg("Your payout link expired. Try setting up again.");
        }
      } finally {
        if (!cancelled) setConnectReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountReady, connectQuery, refreshConnectStatus, userId]);

  async function startConnectOnboarding() {
    setConnectBusy(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      let data: { url?: string; error?: string; code?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setConnectBusy(false);
        setConnectMsg("Couldn't open payout setup. Please try again.");
        return;
      }
      if (!res.ok || !data.url) {
        setConnectBusy(false);
        if (res.status === 401) setConnectMsg("Sign in to set up payouts.");
        else if (res.status === 503 || data.code === "stripe_not_configured") {
          setConnectMsg("Payouts aren't available right now. Please try again later.");
        } else setConnectMsg("Couldn't open payout setup. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setConnectBusy(false);
      setConnectMsg("Couldn't open payout setup. Check your connection and try again.");
    }
  }

  const payoutPill = payoutStatusPill(connect, connectFailed);
  const payoutActionBlocked =
    connectFailed ||
    !connect ||
    !connect.configured ||
    payoutPill.status === "unavailable" ||
    payoutPill.status === "error";

  return (
    <>
      {!connectReady ? (
        <p className="empty-hint">Loading account…</p>
      ) : (
        <section
          className="dashboard-verification-card account-payouts-card"
          aria-labelledby="account-payouts-heading"
        >
          <div className="results-header dashboard-section-toolbar">
            <div>
              <h2 id="account-payouts-heading">Payouts</h2>
            </div>
            <div className="dashboard-section-actions">
              {connectBusy ? (
                <p className="dashboard-payouts-redirect" role="status" aria-live="polite">
                  <span className="dashboard-payouts-spinner" aria-hidden="true" />
                  Redirecting to Stripe — don&apos;t close this tab.
                </p>
              ) : connectFailed ? (
                <button
                  type="button"
                  className="primary-button small"
                  onClick={() => {
                    setConnectMsg(null);
                    void refreshConnectStatus(true);
                  }}
                >
                  Retry
                </button>
              ) : payoutActionBlocked ? null : (
                <button
                  type="button"
                  className="primary-button small"
                  onClick={() => void startConnectOnboarding()}
                >
                  {connect?.onboardingComplete ? "Update payout settings" : "Set up payouts"}
                </button>
              )}
            </div>
          </div>
          <p className="dashboard-verification-status">
            <b>Status:</b>
            <span className={payoutStatusPillClass(payoutPill.status)}>{payoutPill.label}</span>
          </p>
          {payoutPill.helper ? <p className="empty-hint">{payoutPill.helper}</p> : null}
          {connectMsg && connectMsg !== payoutPill.helper ? (
            <p className={connectFailed ? "form-error" : "empty-hint"}>{connectMsg}</p>
          ) : null}
          {!connectFailed ? (
            <p className="empty-hint">
              {payoutPill.status === "not_started" || payoutPill.status === "incomplete"
                ? "No payout account yet. Set up payouts so buyers can purchase your listings."
                : "Buyers can purchase once payouts are set up. DataOnly takes a 10% platform fee."}
            </p>
          ) : null}
        </section>
      )}
      <PaymentMethod userId={userId} />
    </>
  );
}
