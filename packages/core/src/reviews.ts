/** Purchaser reviews — 1–5★ + optional body, one row per (user, datacut). */

export interface Review {
  id: string;
  userId: string;
  datacutId: number;
  rating: number;
  body: string | null;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  /** Public display; never email. Null → UI shows "Buyer". */
  displayName?: string | null;
}

export type ReviewRow = {
  id: string;
  user_id: string;
  datacut_id: number;
  rating: number;
  body: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
};

export function mapReview(
  row: ReviewRow,
  displayName?: string | null,
): Review {
  return {
    id: row.id,
    userId: row.user_id,
    datacutId: Number(row.datacut_id),
    rating: Number(row.rating),
    body: row.body,
    visible: !!row.visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: displayName?.trim() || null,
  };
}

/** Tiny trust-boundary check before insert/update. */
export function validateReviewInput(input: {
  datacutId?: number;
  rating?: number;
  body?: string | null;
  visible?: boolean;
}): { ok: true; rating: number; body: string | null; visible: boolean } | { ok: false; error: string } {
  const datacutId = input.datacutId;
  if (datacutId == null || !Number.isFinite(datacutId) || datacutId < 1) {
    return { ok: false, error: "Missing datacut" };
  }
  const rating = input.rating;
  if (
    rating == null ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { ok: false, error: "Pick a rating from 1 to 5 stars" };
  }
  let body: string | null = null;
  if (input.body != null && input.body !== "") {
    if (typeof input.body !== "string") {
      return { ok: false, error: "Invalid review text" };
    }
    const trimmed = input.body.trim();
    if (trimmed.length > 500) {
      return { ok: false, error: "Keep the review under 500 characters." };
    }
    body = trimmed || null;
  }
  const visible = input.visible === false ? false : true;
  return { ok: true, rating, body, visible };
}

function selfCheckValidateReviewInput() {
  const bad = validateReviewInput({ datacutId: 1, rating: 0 });
  if (bad.ok) throw new Error("rating 0 should fail");
  const ok = validateReviewInput({
    datacutId: 1,
    rating: 5,
    body: "  solid cut  ",
  });
  if (!ok.ok || ok.body !== "solid cut" || !ok.visible) {
    throw new Error("valid review failed");
  }
  const long = validateReviewInput({
    datacutId: 1,
    rating: 3,
    body: "x".repeat(501),
  });
  if (long.ok) throw new Error("body length should fail");
  const hidden = validateReviewInput({
    datacutId: 2,
    rating: 4,
    visible: false,
  });
  if (!hidden.ok || hidden.visible !== false) throw new Error("visible false");
}

const entry =
  typeof globalThis !== "undefined" &&
  "process" in globalThis &&
  Array.isArray((globalThis as { process?: { argv?: string[] } }).process?.argv)
    ? ((globalThis as { process?: { argv?: string[] } }).process?.argv?.[1] ?? "")
    : "";
if (entry.includes("reviews")) {
  selfCheckValidateReviewInput();
}
