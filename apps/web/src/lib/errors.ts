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
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist") ||
    (lower.includes("relation") && lower.includes("exist")) ||
    (lower.includes("foreign key") && lower.includes("profiles"))
  );
}
