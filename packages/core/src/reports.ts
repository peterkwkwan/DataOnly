/** Beta report / takedown — product reasons + states (not counsel-final copy). */

export const REPORT_REASONS = [
  "copyright",
  "privacy",
  "prohibited",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = [
  "open",
  "under_review",
  "removed",
  "no_action",
  "escalate",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type ReportTargetType = "datacut" | "creator";

export interface Report {
  id: string;
  targetType: ReportTargetType;
  datacutId: number | null;
  creatorId: string | null;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reporterId: string | null;
  reporterEmail: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  outcomeNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  copyright: "Copyright / IP",
  privacy: "Privacy / personal data",
  prohibited: "Prohibited content",
  spam: "Spam / scam",
  other: "Other",
};

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

/** Tiny trust-boundary check before insert. */
export function validateReportInput(input: {
  targetType: string;
  datacutId?: number | null;
  creatorId?: string | null;
  reason: string;
  details?: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.targetType !== "datacut" && input.targetType !== "creator") {
    return { ok: false, error: "Invalid report target" };
  }
  if (!isReportReason(input.reason)) {
    return { ok: false, error: "Pick a report reason" };
  }
  if (input.targetType === "datacut" && (input.datacutId == null || input.datacutId < 1)) {
    return { ok: false, error: "Missing datacut" };
  }
  if (input.targetType === "creator" && !input.creatorId?.trim()) {
    return { ok: false, error: "Missing creator" };
  }
  const details = (input.details ?? "").trim();
  if (details.length > 4000) {
    return { ok: false, error: "Details are too long (max 4000 characters)" };
  }
  return { ok: true };
}
