import type { Creator } from "@dataonly/core";
import { ensureCreatorForUser as ensureCreatorForUserCore } from "@dataonly/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Ensure the signed-in user has a creator row (create on first dashboard visit). */
export async function ensureCreatorForUser(
  client: SupabaseClient,
  user: { id: string; email?: string | null },
  displayName?: string | null,
): Promise<Creator> {
  return ensureCreatorForUserCore(client, user, displayName);
}
