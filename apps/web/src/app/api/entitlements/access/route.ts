import {
  LICENSE_SUMMARIES,
  mapEntitlement,
  type EntitlementRow,
} from "@dataonly/core";
import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Gated access for a purchased datacut.
 * MVP: returns a JSON access stub (no Storage file yet). Real file URLs land later.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const datacutId = Number(searchParams.get("datacutId"));
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "datacutId query required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: entitlementRow, error: entError } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", user.id)
    .eq("datacut_id", datacutId)
    .eq("status", "active")
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }
  if (!entitlementRow) {
    return NextResponse.json(
      { error: "Purchase required to access this datacut", code: "not_entitled" },
      { status: 403 },
    );
  }

  const { data: cut, error: cutError } = await supabase
    .from("datacuts")
    .select("id, slug, title, format, size, records, license, description, creators(name)")
    .eq("id", datacutId)
    .maybeSingle();

  if (cutError || !cut) {
    return NextResponse.json({ error: cutError?.message ?? "Datacut missing" }, { status: 404 });
  }

  const entitlement = mapEntitlement(entitlementRow as EntitlementRow);
  const creatorRel = cut.creators;
  const creatorName = Array.isArray(creatorRel)
    ? creatorRel[0]?.name
    : (creatorRel as { name?: string } | null)?.name;

  return NextResponse.json({
    access: "granted",
    delivery: {
      mode: "stub",
      note: "File Storage delivery is not wired yet. Entitlement gate is live — replace this stub with a signed Storage URL.",
      format: cut.format,
      size: cut.size,
      records: cut.records,
    },
    datacut: {
      id: cut.id,
      slug: cut.slug,
      title: cut.title,
      creatorName: creatorName ?? null,
      description: cut.description,
    },
    license: {
      template: entitlement.license,
      version: entitlement.licenseVersion,
      summary: LICENSE_SUMMARIES[entitlement.license],
    },
    entitlement: {
      id: entitlement.id,
      purchasedAt: entitlement.createdAt,
      amountCents: entitlement.amountCents,
      currency: entitlement.currency,
    },
  });
}
