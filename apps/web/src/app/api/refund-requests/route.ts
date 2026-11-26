import {
  isCurrentAccessCharge,
  refundBuyerCopy,
  refundEligibility,
  type RefundEligibilityInput,
} from "@dataonly/core";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  purchaseId?: string;
  note?: string | null;
};

function unavailable() {
  return NextResponse.json(
    { error: "Supabase not configured", code: "supabase_not_configured" },
    { status: 503 },
  );
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    return (await request.json()) as Body;
  } catch {
    return null;
  }
}

/** Buyer files a refund request on one ledger row. Does not call Stripe. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return unavailable();

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const purchaseId = body.purchaseId?.trim() || "";
  if (!purchaseId) {
    return NextResponse.json(
      { error: "purchaseId is required", code: "purchase_required" },
      { status: 400 },
    );
  }

  let note: string | null = null;
  if (body.note != null && body.note !== "") {
    if (typeof body.note !== "string") {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }
    const trimmed = body.note.trim();
    if (trimmed.length > 500) {
      return NextResponse.json(
        { error: "Keep the note under 500 characters.", code: "note_too_long" },
        { status: 400 },
      );
    }
    note = trimmed || null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const admin = createServiceSupabaseClient();
  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .select(
      "id, user_id, datacut_id, status, created_at, stripe_payment_intent_id, refund_requested_at, refund_request_note",
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseError) {
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }
  if (!purchase || purchase.user_id !== user.id) {
    return NextResponse.json({ error: "Purchase not found", code: "not_found" }, { status: 404 });
  }

  const { data: entitlement, error: entError } = await admin
    .from("entitlements")
    .select("status, downloaded_at, stripe_payment_intent_id")
    .eq("user_id", user.id)
    .eq("datacut_id", purchase.datacut_id)
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }

  const eligibilityInput: RefundEligibilityInput = {
    purchaseStatus: purchase.status,
    purchaseCreatedAt: purchase.created_at,
    paymentIntentId: purchase.stripe_payment_intent_id,
    refundRequestedAt: purchase.refund_requested_at,
    isCurrentAccessCharge: isCurrentAccessCharge(
      purchase.stripe_payment_intent_id,
      entitlement?.stripe_payment_intent_id,
    ),
    entitlementStatus: entitlement?.status ?? null,
    entitlementDownloadedAt: entitlement?.downloaded_at ?? null,
  };
  const eligibility = refundEligibility(eligibilityInput);

  if (!eligibility.ok && eligibility.code === "already_requested") {
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      refundRequestedAt: purchase.refund_requested_at,
    });
  }
  if (!eligibility.ok) {
    const copy = refundBuyerCopy(eligibilityInput);
    return NextResponse.json(
      { error: copy.paragraphs.join(" "), code: eligibility.code },
      { status: 409 },
    );
  }

  const requestedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("purchases")
    .update({
      refund_requested_at: requestedAt,
      refund_request_note: note,
    })
    .eq("id", purchase.id)
    .is("refund_requested_at", null)
    .select("refund_requested_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    const { data: again } = await admin
      .from("purchases")
      .select("refund_requested_at")
      .eq("id", purchase.id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      refundRequestedAt: again?.refund_requested_at ?? purchase.refund_requested_at,
    });
  }

  return NextResponse.json({
    ok: true,
    alreadyRequested: false,
    refundRequestedAt: updated.refund_requested_at,
  });
}

/** Admin clears a request. Does not refund and does not change access. */
export async function DELETE(request: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return unavailable();

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const purchaseId = body.purchaseId?.trim() || "";
  if (!purchaseId) {
    return NextResponse.json(
      { error: "purchaseId is required", code: "purchase_required" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only", code: "forbidden" }, { status: 403 });
  }

  const admin = createServiceSupabaseClient();
  const { data, error } = await admin
    .from("purchases")
    .update({
      refund_requested_at: null,
      refund_request_note: null,
    })
    .eq("id", purchaseId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Purchase not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
