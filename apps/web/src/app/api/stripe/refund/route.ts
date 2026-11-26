import {
  isCurrentAccessCharge,
  refundBuyerCopy,
  refundEligibility,
  type RefundEligibilityInput,
} from "@dataonly/core";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { isStripeConfigured } from "@/lib/stripe/config";
import { markEntitlementRefundedByPaymentIntent } from "@/lib/stripe/entitlements";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  purchaseId?: string;
};

const REFUND_UNAVAILABLE =
  "Refunds aren't available right now. Please try again later.";

const ALREADY_DOWNLOADED =
  "This purchase can't be refunded because the buyer already downloaded the datacut.";

/**
 * Admin refund: Stripe refunds.create on that ledger row's PaymentIntent,
 * then mark the ledger refunded. The entitlement flips only when this payment
 * is still the current access charge.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: REFUND_UNAVAILABLE, code: "stripe_not_configured" },
      { status: 503 },
    );
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: REFUND_UNAVAILABLE, code: "service_role_missing" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .select(
      "id, status, stripe_payment_intent_id, user_id, datacut_id, created_at, refund_requested_at",
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseError) {
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found", code: "not_found" }, { status: 404 });
  }

  if (purchase.status === "refunded") {
    return NextResponse.json({
      ok: true,
      alreadyRefunded: true,
      purchaseId: purchase.id,
      status: "refunded",
    });
  }

  const { data: entitlement, error: entError } = await admin
    .from("entitlements")
    .select("status, downloaded_at, stripe_payment_intent_id")
    .eq("user_id", purchase.user_id)
    .eq("datacut_id", purchase.datacut_id)
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }

  const current = isCurrentAccessCharge(
    purchase.stripe_payment_intent_id,
    entitlement?.stripe_payment_intent_id,
  );
  const eligibilityInput: RefundEligibilityInput = {
    purchaseStatus: purchase.status,
    purchaseCreatedAt: purchase.created_at,
    paymentIntentId: purchase.stripe_payment_intent_id,
    refundRequestedAt: purchase.refund_requested_at,
    isCurrentAccessCharge: current,
    entitlementStatus: entitlement?.status ?? null,
    entitlementDownloadedAt: entitlement?.downloaded_at ?? null,
  };
  const eligibility = refundEligibility(eligibilityInput);

  if (!eligibility.ok && eligibility.code !== "already_requested") {
    if (eligibility.code === "downloaded") {
      return NextResponse.json(
        {
          error: ALREADY_DOWNLOADED,
          code: "already_downloaded",
          downloadedAt: entitlement?.downloaded_at ?? null,
        },
        { status: 409 },
      );
    }
    const copy = refundBuyerCopy(eligibilityInput);
    return NextResponse.json(
      { error: copy.paragraphs.join(" "), code: eligibility.code },
      { status: 409 },
    );
  }

  const paymentIntentId = purchase.stripe_payment_intent_id?.trim() || "";
  const stripe = getStripe();
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    console.error("[stripe refund]", purchaseId, paymentIntentId, message);
    const already =
      /already.?refunded/i.test(message) || /has already been refunded/i.test(message);
    if (!already) {
      return NextResponse.json(
        { error: "Couldn't issue the refund. Please try again.", code: "stripe_refund_failed" },
        { status: 502 },
      );
    }
  }

  try {
    await markEntitlementRefundedByPaymentIntent(paymentIntentId);
    return NextResponse.json({
      ok: true,
      purchaseId: purchase.id,
      status: "refunded",
      paymentIntentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update access";
    console.error("[stripe refund] mark failed", purchaseId, message);
    return NextResponse.json(
      {
        error:
          "Refund may have succeeded, but access wasn't updated yet. It usually syncs within a few seconds.",
        code: "entitlement_update_failed",
      },
      { status: 500 },
    );
  }
}
