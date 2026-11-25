import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import {
  sessionLooksPaid,
  upsertEntitlementFromSession,
} from "@/lib/stripe/entitlements";
import { isStripeConfigured } from "@/lib/stripe/config";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import { getAuthedRequest } from "@/lib/supabase/request-auth";

export const runtime = "nodejs";

type Body = {
  sessionId?: string;
};

/**
 * Buyer-side recovery: after Checkout success_url lands with session_id,
 * confirm the paid session against Stripe and upsert the entitlement.
 * Same write path as the webhook (service_role). Safe to call repeatedly.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured", code: "stripe_not_configured" },
      { status: 503 },
    );
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not set",
        code: "service_role_missing",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() || "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "sessionId (cs_…) is required", code: "session_required" },
      { status: 400 },
    );
  }

  const { user } = await getAuthedRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session retrieve failed";
    return NextResponse.json({ error: message, code: "session_not_found" }, { status: 404 });
  }

  if (!sessionLooksPaid(session)) {
    return NextResponse.json(
      {
        error: "Checkout session is not paid/complete yet",
        code: "not_paid",
        paymentStatus: session.payment_status,
        status: session.status,
      },
      { status: 409 },
    );
  }

  const metaUser = session.metadata?.user_id?.trim();
  const clientRef =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id.trim()
      : "";
  const buyerId = metaUser || clientRef;
  if (!buyerId || buyerId !== user.id) {
    return NextResponse.json(
      { error: "This Checkout session does not belong to the signed-in user", code: "forbidden" },
      { status: 403 },
    );
  }

  try {
    const result = await upsertEntitlementFromSession(session);
    return NextResponse.json({
      ok: true,
      entitled: true,
      sessionId: result.sessionId,
      datacutId: result.datacutId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Entitlement upsert failed";
    console.error("[stripe confirm]", sessionId, message);
    return NextResponse.json({ error: message, code: "upsert_failed" }, { status: 500 });
  }
}
