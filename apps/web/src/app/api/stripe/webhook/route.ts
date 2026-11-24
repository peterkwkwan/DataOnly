import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { retrieveConnectFlagsV2 } from "@/lib/stripe/connect";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function upsertEntitlementFromSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const datacutId = Number(meta.datacut_id);
  const license = meta.license === "commercial" ? "commercial" : "personal";
  const licenseVersion = meta.license_version || "v1";
  const platformFeeCents = Number(meta.platform_fee_cents || 0);
  const stripeAccountId = meta.stripe_account_id || null;

  if (!userId || !Number.isFinite(datacutId)) {
    throw new Error("Checkout session missing user_id / datacut_id metadata");
  }

  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : 0;
  const currency = session.currency || "usd";
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const admin = createServiceSupabaseClient();

  if (session.customer && typeof session.customer === "string") {
    await admin
      .from("profiles")
      .update({ stripe_customer_id: session.customer })
      .eq("id", userId)
      .is("stripe_customer_id", null);
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      user_id: userId,
      datacut_id: datacutId,
      license,
      license_version: licenseVersion,
      amount_cents: amountCents,
      currency,
      platform_fee_cents: Number.isFinite(platformFeeCents) ? platformFeeCents : 0,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      stripe_account_id: stripeAccountId,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,datacut_id" },
  );

  if (error) throw error;
}

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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid" || session.status === "complete") {
          await upsertEntitlementFromSession(session);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await syncConnectAccountById(account.id);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
