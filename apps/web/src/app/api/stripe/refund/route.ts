import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { isStripeConfigured } from "@/lib/stripe/config";
import {
  markEntitlementRefundedById,
  markEntitlementRefundedByPaymentIntent,
} from "@/lib/stripe/entitlements";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  entitlementId?: string;
};

const REFUND_UNAVAILABLE =
  "Refunds aren't available right now. Please try again later.";

/**
 * Admin refund: Stripe refunds.create on the Checkout PaymentIntent, then mark
 * the entitlement refunded. Destination charges reverse the transfer + fee.
 * Webhook charge.refunded / payment_intent.refunded also sync status (idempotent).
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

  const entitlementId = body.entitlementId?.trim() || "";
  if (!entitlementId) {
    return NextResponse.json(
      { error: "entitlementId is required", code: "entitlement_required" },
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
  const { data: entitlement, error: entError } = await admin
    .from("entitlements")
    .select(
      "id, status, stripe_payment_intent_id, user_id, datacut_id, amount_cents, currency, downloaded_at",
    )
    .eq("id", entitlementId)
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }
  if (!entitlement) {
    return NextResponse.json({ error: "Purchase not found", code: "not_found" }, { status: 404 });
  }

  if (entitlement.status === "refunded" || entitlement.status === "revoked") {
    return NextResponse.json({
      ok: true,
      alreadyRefunded: true,
      entitlementId: entitlement.id,
      status: entitlement.status,
    });
  }

  if (entitlement.downloaded_at) {
    return NextResponse.json(
      {
        error:
          "This purchase can't be refunded because the buyer already downloaded the datacut.",
        code: "already_downloaded",
        downloadedAt: entitlement.downloaded_at,
      },
      { status: 409 },
    );
  }

  if (entitlement.status !== "active" && entitlement.status !== "pending") {
    return NextResponse.json(
      { error: "This purchase can't be refunded", code: "not_refundable" },
      { status: 409 },
    );
  }

  const paymentIntentId = entitlement.stripe_payment_intent_id?.trim() || "";
  if (!paymentIntentId) {
    return NextResponse.json(
      {
        error: "This purchase has no payment to refund",
        code: "missing_payment_intent",
      },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      // Destination charge: claw back transfer to creator + platform fee.
      reverse_transfer: true,
      refund_application_fee: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    console.error("[stripe refund]", entitlementId, paymentIntentId, message);
    // Already-refunded in Stripe → still mark entitlement locally.
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
    const marked = await markEntitlementRefundedById(entitlement.id);
    // Belt-and-suspenders if id path raced with webhook keyed by PI.
    if (paymentIntentId) {
      await markEntitlementRefundedByPaymentIntent(paymentIntentId);
    }
    return NextResponse.json({
      ok: true,
      entitlementId: marked.id,
      status: marked.status,
      paymentIntentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update access";
    console.error("[stripe refund] entitlement mark failed", entitlementId, message);
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
