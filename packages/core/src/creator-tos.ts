import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

/**
 * Bump this string when material ToS updates ship.
 * Creators with a different `profiles.tos_version` must re-accept.
 */
export const CREATOR_TOS_VERSION = "2026-11-24-draft";

export type CreatorTosSection = {
  title: string;
  body: string;
};

/** Draft product outline — counsel finalizes legal wording later. */
export const CREATOR_TOS_DRAFT_NOTICE =
  "DRAFT — product policy outline only. Not final legal text. Counsel will finalize wording before Store.";

export const CREATOR_TOS_SECTIONS: CreatorTosSection[] = [
  {
    title: "Ownership warranty",
    body: "You warrant that you own, or have the right to list and sell, each datacut you upload. You are responsible for the accuracy of that warranty.",
  },
  {
    title: "Infringement liability",
    body: "Infringement and rights-clearance risk sits with you (the uploader), not DataOnly. You remain liable for claims arising from content you list.",
  },
  {
    title: "Platform actions",
    body: "DataOnly may remove content, suspend or terminate accounts, and cooperate with lawful takedown requests when content appears to violate these terms or applicable law.",
  },
  {
    title: "Disclaimer",
    body: "DataOnly does not guarantee that any dataset is legally clean, rights-cleared, or fit for a particular purpose. Buyers and creators must make their own diligence decisions.",
  },
];

export const CREATOR_TOS_ACCEPT_LABEL =
  "I have read this Creator Terms outline and accept that ownership warranty and infringement liability sit with me as the uploader.";

export function hasAcceptedCreatorTos(
  profile: Pick<Profile, "tosAcceptedAt" | "tosVersion"> | null | undefined,
  currentVersion: string = CREATOR_TOS_VERSION,
): boolean {
  if (!profile?.tosAcceptedAt) return false;
  return profile.tosVersion === currentVersion;
}

/** Persist acceptance for the signed-in user (own row via RLS). */
export async function acceptCreatorTos(
  client: SupabaseClient,
  userId: string,
  version: string = CREATOR_TOS_VERSION,
): Promise<{ tosAcceptedAt: string; tosVersion: string }> {
  const tosAcceptedAt = new Date().toISOString();
  const { error } = await client
    .from("profiles")
    .update({
      tos_accepted_at: tosAcceptedAt,
      tos_version: version,
    })
    .eq("id", userId);
  if (error) throw error;
  return { tosAcceptedAt, tosVersion: version };
}
