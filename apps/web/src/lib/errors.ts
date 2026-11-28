/** PostgREST/Postgres missing table GRANT (42501) — service_role bypasses RLS, not privileges. */
export function isDbPermissionError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === "42501") return true;
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return msg.includes("permission denied");
}

/**
 * Hard-delete blocked by entitlements/purchases FK (ON DELETE RESTRICT → 23503).
 * Prefer unpublish when the listing has buyers.
 */
export function datacutDeleteBlockedMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code =
    "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : "";
  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  const details =
    "details" in err && typeof (err as { details: unknown }).details === "string"
      ? (err as { details: string }).details
      : "";
  const blob = `${message} ${details}`.toLowerCase();
  const isFk = code === "23503" || blob.includes("foreign key") || blob.includes("violates");
  if (!isFk) return null;
  if (
    blob.includes("entitlements") ||
    blob.includes("purchases") ||
    blob.includes("entitlements_datacut_id_fkey") ||
    blob.includes("purchases_datacut_id_fkey")
  ) {
    return "This listing has buyers — unpublish it instead of deleting.";
  }
  if (code === "23503") {
    return "This listing can’t be deleted because related records still reference it. Unpublish it instead.";
  }
  return null;
}

function assertDatacutDeleteBlockedMessage() {
  const buyers = datacutDeleteBlockedMessage({
    code: "23503",
    message: "update or delete on table \"datacuts\" violates foreign key constraint",
    details: "Key is still referenced from table \"entitlements\".",
  });
  const other = datacutDeleteBlockedMessage({ code: "42501", message: "permission denied" });
  if (
    buyers !== "This listing has buyers — unpublish it instead of deleting." ||
    other !== null
  ) {
    throw new Error("datacutDeleteBlockedMessage");
  }
}
assertDatacutDeleteBlockedMessage();

/** Extract a readable message from Error, PostgREST, Auth, or plain `{ message }` throws. */
export function formatClientError(err: unknown, fallback: string): string {
  let message = fallback;
  if (err instanceof Error && err.message.trim()) {
    message = err.message.trim();
  } else if (typeof err === "string" && err.trim()) {
    message = err.trim();
  } else if (err && typeof err === "object" && "message" in err) {
    const raw = (err as { message: unknown }).message;
    if (typeof raw === "string" && raw.trim()) message = raw.trim();
  }

  const code =
    err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  const details =
    err && typeof err === "object" && "details" in err && typeof (err as { details: unknown }).details === "string"
      ? (err as { details: string }).details.trim()
      : undefined;

  const parts = [message];
  if (code) parts.push(`(${code})`);
  if (details && details !== message) parts.push(details);

  const combined = parts.join(" ");
  if (looksLikeMissingSchema(combined, code)) {
    return `${combined} — If you just connected Supabase, run the SQL migrations + seed in the repo README (supabase/migrations, then supabase/seed.sql), then reload.`;
  }
  return combined;
}

function looksLikeMissingSchema(message: string, code?: string) {
  const lower = message.toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  if (code === "23503") return true; // FK — often missing seed datacuts or profile row
  if (code === "42501") return true; // missing GRANTs
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist") ||
    (lower.includes("relation") && lower.includes("exist")) ||
    lower.includes("foreign key") ||
    lower.includes("permission denied")
  );
}
