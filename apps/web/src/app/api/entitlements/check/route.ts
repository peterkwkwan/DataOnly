import { LICENSE_SUMMARIES, mapEntitlement, type EntitlementRow } from "@dataonly/core";
import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entitled: false, reason: "supabase_not_configured" });
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
    return NextResponse.json({ entitled: false, reason: "auth_required" });
  }

  const { data, error } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", user.id)
    .eq("datacut_id", datacutId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ entitled: false, reason: "not_entitled" });
  }

  const entitlement = mapEntitlement(data as EntitlementRow);
  const summary = LICENSE_SUMMARIES[entitlement.license];

  return NextResponse.json({
    entitled: true,
    entitlement,
    licenseSummary: summary,
  });
}
