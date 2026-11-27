import { NextResponse } from "next/server";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreatorJoin = { user_id: string } | { user_id: string }[] | null;

function creatorUserId(creators: CreatorJoin): string | null {
  if (!creators) return null;
  if (Array.isArray(creators)) return creators[0]?.user_id ?? null;
  return creators.user_id ?? null;
}

/**
 * Creator-owned listing aggregates. Session → ownership → service-role counts.
 * JSON only: no buyer PII or purchase line items.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "Stats unavailable", code: "service_role_missing" },
      { status: 503 },
    );
  }

  const { id: rawId } = await context.params;
  const datacutId = Number(rawId);
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: cut, error: cutError } = await supabase
    .from("datacuts")
    .select("id, creator_id, creators(user_id)")
    .eq("id", datacutId)
    .maybeSingle();

  if (cutError) {
    return NextResponse.json({ error: cutError.message }, { status: 500 });
  }
  if (!cut) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerId = creatorUserId(cut.creators as CreatorJoin);
  let isAdmin = false;
  if (ownerId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }
  if (ownerId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let viewsRes;
  let purchasesRes;
  let downloadsRes;
  let savesRes;
  try {
    const admin = createServiceSupabaseClient();
    [viewsRes, purchasesRes, downloadsRes, savesRes] = await Promise.all([
      admin
        .from("listing_page_views")
        .select("*", { count: "exact", head: true })
        .eq("datacut_id", datacutId),
      admin
        .from("purchases")
        .select("status, amount_cents, currency")
        .eq("datacut_id", datacutId)
        .in("status", ["paid", "refunded"]),
      admin
        .from("entitlements")
        .select("*", { count: "exact", head: true })
        .eq("datacut_id", datacutId)
        .not("downloaded_at", "is", null),
      admin
        .from("saved")
        .select("*", { count: "exact", head: true })
        .eq("datacut_id", datacutId),
    ]);
  } catch (err) {
    console.error("[listing stats] service query failed", err);
    return NextResponse.json({ error: "Stats unavailable" }, { status: 503 });
  }

  // Missing tables / query failures → zeros (empty activity), not 500
  for (const [label, res] of [
    ["views", viewsRes],
    ["purchases", purchasesRes],
    ["downloads", downloadsRes],
    ["saves", savesRes],
  ] as const) {
    if (res.error) console.warn(`[listing stats] ${label}:`, res.error.message);
  }

  const rows = purchasesRes.error ? [] : (purchasesRes.data ?? []);
  let paid = 0;
  let refunded = 0;
  let revenueCents = 0;
  let currency = "usd";
  for (const row of rows) {
    if (row.status === "paid") {
      paid += 1;
      revenueCents += Number(row.amount_cents) || 0;
      if (row.currency) currency = String(row.currency);
    } else if (row.status === "refunded") {
      refunded += 1;
      if (row.currency) currency = String(row.currency);
    }
  }
  const denom = paid + refunded;
  const refundRate = denom === 0 ? 0 : refunded / denom;

  return NextResponse.json({
    views: viewsRes.error ? 0 : (viewsRes.count ?? 0),
    purchases: paid,
    revenueCents,
    currency,
    refundRate,
    downloads: downloadsRes.error ? 0 : (downloadsRes.count ?? 0),
    saves: savesRes.error ? 0 : (savesRes.count ?? 0),
  });
}
