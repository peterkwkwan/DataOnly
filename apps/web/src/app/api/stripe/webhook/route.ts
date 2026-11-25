import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { retrieveConnectFlagsV2 } from "@/lib/stripe/connect";
import {
  markEntitlementRefundedByPaymentIntent,
  sessionLooksPaid,
  upsertEntitlementFromSession,
} from "@/lib/stripe/entitlements";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Sync creators.stripe_* from Accounts v2 (recipient stripe_transfers). */
async function syncConnectAccountById(accountId: string) {
  const flags = await retrieveConnectFlagsV2(accountId);
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("creators")
    .update({
      stripe_charges_enabled: flags.chargesEnabled,
      stripe_details_submitted: flags.detailsSubmitted,
      stripe_onboarding_complete: flags.onboardingComplete,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId);
  if (error) throw error;
}

function paymentIntentIdFromCharge(charge: Stripe.Charge): string | null {
  const pi = charge.payment_intent;
  if (typeof pi === "string" && pi.trim()) return pi.trim();
  if (pi && typeof pi === "object" && "id" in pi && typeof pi.id === "string") {
    return pi.id;
  }
  return null;
}

async function handlePaymentIntentRefunded(paymentIntentId: string, eventType: string) {
  const result = await markEntitlementRefundedByPaymentIntent(paymentIntentId);
  console.info(
    `[stripe webhook] entitlement refunded pi=${paymentIntentId} updated=${result.updated} event=${eventType}`,
  );
}

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (sessionLooksPaid(session)) {
          const result = await upsertEntitlementFromSession(session);
          console.info(
            `[stripe webhook] entitlement upserted session=${result.sessionId} user=${result.entitlementUserId} datacut=${result.datacutId} event=${event.type}`,
          );
        } else {
          console.warn(
            `[stripe webhook] skip entitlement session=${session.id} payment_status=${session.payment_status} status=${session.status}`,
          );
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await syncConnectAccountById(account.id);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = paymentIntentIdFromCharge(charge);
        if (piId) {
          await handlePaymentIntentRefunded(piId, event.type);
        } else {
          console.warn(
            `[stripe webhook] charge.refunded missing payment_intent charge=${charge.id}`,
          );
        }
        break;
      }
      default: {
        // Some API versions emit payment_intent.refunded; not in every Stripe SDK typings set.
        if ((event.type as string) === "payment_intent.refunded") {
          const pi = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntentRefunded(pi.id, event.type);
        }
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[stripe webhook]", event.type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
