/** Private Supabase Storage bucket for purchased datacut files. */
export const DATACUT_STORAGE_BUCKET = "datacuts";

/** Signed download URL lifetime (seconds). Short-lived; re-mint on each Download click. */
export const SIGNED_URL_EXPIRES_SEC = 120;

/** Object key: `{creatorId}/{datacutId}/{safeFileName}` or `…/sample/{safeFileName}` */
export function buildDatacutObjectPath(
  creatorId: string,
  datacutId: number | string,
  fileName: string,
  opts?: { sample?: boolean },
): string {
  const safe = sanitizeFileName(fileName);
  if (opts?.sample) return `${creatorId}/${datacutId}/sample/${safe}`;
  return `${creatorId}/${datacutId}/${safe}`;
}

export function sanitizeFileName(name: string): string {
  const base = name.trim().replace(/[/\\]/g, "_").replace(/\0/g, "");
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").replace(/_+/g, "_");
  return (cleaned || "download.bin").slice(0, 180);
}
