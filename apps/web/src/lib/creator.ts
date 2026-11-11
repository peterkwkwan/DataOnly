import type { Creator } from "@dataonly/core";
import { mapCreator, type CreatorRow } from "@dataonly/core";
import type { SupabaseClient } from "@supabase/supabase-js";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Ensure the signed-in user has a creator row (create on first dashboard visit). */
export async function ensureCreatorForUser(
  client: SupabaseClient,
  user: { id: string; email?: string | null },
  displayName?: string | null,
): Promise<Creator> {
  const { data: existing, error: existingError } = await client
    .from("creators")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return mapCreator(existing as CreatorRow);

  const name =
    displayName?.trim() ||
    user.email?.split("@")[0] ||
    "New Creator";
  const baseSlug = slugify(name) || `creator-${user.id.slice(0, 8)}`;
  let slug = baseSlug;
  for (let i = 0; i < 5; i += 1) {
    const { data: clash } = await client.from("creators").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const row = {
    id: `c-${user.id}`,
    user_id: user.id,
    name,
    slug,
    specialty: "Creator",
    cuts: 0,
    followers: "0",
    initials: initialsFrom(name),
    color: "#c6ff4a",
    verified: false,
    bio: "New DataOnly creator storefront.",
  };

  const { data, error } = await client.from("creators").insert(row).select("*").single();
  if (error) throw error;

  await client.from("profiles").update({ role: "creator" }).eq("id", user.id).neq("role", "admin");

  return mapCreator(data as CreatorRow);
}
