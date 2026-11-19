/** Alpha verified sources: human-reviewed evidence links (not OAuth ownership). */

export type VerifiedSourcePlatform = "youtube" | "linkedin";

export interface VerifiedSource {
  platform: VerifiedSourcePlatform;
  url: string;
}

export const VERIFIED_SOURCE_PLATFORMS: ReadonlyArray<{
  id: VerifiedSourcePlatform;
  label: string;
}> = [
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
];

const PLATFORM_HOSTS: Record<VerifiedSourcePlatform, readonly string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  linkedin: ["linkedin.com"],
};

export function isVerifiedSourcePlatform(value: unknown): value is VerifiedSourcePlatform {
  return value === "youtube" || value === "linkedin";
}

export function verifiedSourcePlatformLabel(platform: VerifiedSourcePlatform): string {
  return VERIFIED_SOURCE_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
}

/** Empty editable row for the apply form (always keep ≥1). */
export function emptyVerifiedSourceRow(
  platform: VerifiedSourcePlatform = "youtube",
): VerifiedSource {
  return { platform, url: "" };
}

export function normalizeVerifiedSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(normalizeVerifiedSourceUrl(url)).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatchesPlatform(host: string, platform: VerifiedSourcePlatform): boolean {
  const bare = host.replace(/^www\./, "");
  return PLATFORM_HOSTS[platform].some((allowed) => bare === allowed || bare.endsWith(`.${allowed}`));
}

/** Light client check: URL parses and host matches the selected platform. */
export function isVerifiedSourceUrlValid(platform: VerifiedSourcePlatform, url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return hostMatchesPlatform(host, platform);
}

function canonicalizeUrlForDedupe(url: string): string {
  try {
    const parsed = new URL(normalizeVerifiedSourceUrl(url));
    parsed.hash = "";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${host}${port}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function parseVerifiedSources(raw: unknown): VerifiedSource[] {
  if (!Array.isArray(raw)) return [];
  const out: VerifiedSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const platform = (item as { platform?: unknown }).platform;
    const url = (item as { url?: unknown }).url;
    if (!isVerifiedSourcePlatform(platform) || typeof url !== "string") continue;
    out.push({ platform, url });
  }
  return out;
}

export type VerifiedSourcesValidation =
  | { ok: true; sources: VerifiedSource[] }
  | { ok: false; error: string };

/**
 * Validate apply-form rows. Empty URL rows are ignored.
 * Requires ≥1 complete source; blocks invalid hosts and duplicate URLs.
 */
export function validateVerifiedSources(rows: VerifiedSource[]): VerifiedSourcesValidation {
  const completed = rows
    .map((row) => ({
      platform: row.platform,
      url: row.url.trim(),
    }))
    .filter((row) => row.url.length > 0);

  if (completed.length === 0) {
    return { ok: false, error: "Add at least one verified source with a URL." };
  }

  const seen: string[] = [];
  const sources: VerifiedSource[] = [];

  for (const row of completed) {
    if (!isVerifiedSourcePlatform(row.platform)) {
      return { ok: false, error: "Each source needs a platform (YouTube or LinkedIn)." };
    }
    const normalized = normalizeVerifiedSourceUrl(row.url);
    if (!isVerifiedSourceUrlValid(row.platform, normalized)) {
      return {
        ok: false,
        error: `URL must be a valid ${verifiedSourcePlatformLabel(row.platform)} link.`,
      };
    }
    const key = canonicalizeUrlForDedupe(normalized);
    if (seen.includes(key)) {
      return { ok: false, error: "Duplicate source URLs are not allowed." };
    }
    seen.push(key);
    sources.push({ platform: row.platform, url: normalized });
  }

  return { ok: true, sources };
}
