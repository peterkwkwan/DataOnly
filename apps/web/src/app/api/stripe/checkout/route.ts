import { LICENSE_TEMPLATE_VERSION, licenseBlurb } from "@dataonly/core";
import { NextResponse } from "next/server";
import {
  amountToCents,
  appOrigin,
  getPlatformFeePercent,
  isStripeConfigured,
  platformFeeCents,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import {
  isAllowedMobileReturnUrl,
  mobileCheckoutBridgeUrl,
} from "@/lib/stripe/mobile-return";
import { getAuthedRequest } from "@/lib/supabase/request-auth";

type Body = {
  datacutId?: number;
  /** Expo Linking.createURL base (no query). Enables mobile deep-link return. */
  mobileReturnUrl?: string;
};

/** Buyer-facing copy — no Connect/Stripe API/config terms. */
const CHECKOUT_UNAVAILABLE =
  "Checkout isn’t available for this listing right now. Try again later or contact the creator.";

/**
 * Creates a Stripe Checkout Session for a published datacut.
 * Destination charge → creator Connect account + platform application fee.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    console.error("[stripe checkout] Stripe is not configured (missing publishable/secret keys)");
    return NextResponse.json(
      {
        error: CHECKOUT_UNAVAILABLE,
        code: "stripe_not_configured",
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

  const datacutId = Number(body.datacutId);
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "datacutId is required" }, { status: 400 });
  }

  const mobileReturnUrl =
    typeof body.mobileReturnUrl === "string" ? body.mobileReturnUrl.trim() : "";
  if (mobileReturnUrl && !isAllowedMobileReturnUrl(mobileReturnUrl)) {
    return NextResponse.json(
      { error: "Invalid mobileReturnUrl", code: "invalid_return_url" },
      { status: 400 },
    );
  }

  const { user, supabase } = await getAuthedRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: cut, error: cutError } = await supabase
    .from("datacuts")
    .select(
      "id, slug, title, price, license, status, creator_id, creators(id, name, stripe_account_id, stripe_charges_enabled, user_id)",
    )
    .eq("id", datacutId)
    .maybeSingle();

  if (cutError) {
    console.error("[stripe checkout] datacut lookup failed", cutError.message);
    return NextResponse.json({ error: CHECKOUT_UNAVAILABLE }, { status: 500 });
  }
  if (!cut || cut.status !== "published") {
    return NextResponse.json({ error: "Datacut not available for purchase" }, { status: 404 });
  }

  const creatorRel = cut.creators;
  const creator = Array.isArray(creatorRel) ? creatorRel[0] : creatorRel;
  if (!creator?.stripe_account_id || !creator.stripe_charges_enabled) {
    console.error(
      "[stripe checkout] creator not ready for destination charges",
      {
        datacutId: cut.id,
        creatorId: creator?.id ?? null,
        hasStripeAccount: Boolean(creator?.stripe_account_id),
        chargesEnabled: Boolean(creator?.stripe_charges_enabled),
      },
    );
    return NextResponse.json(
      {
        error: CHECKOUT_UNAVAILABLE,
        code: "creator_not_onboarded",
      },
      { status: 409 },
    );
  }

  if (creator.user_id && creator.user_id === user.id) {
    return NextResponse.json({ error: "You cannot purchase your own datacut" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("entitlements")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("datacut_id", cut.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already own this datacut", code: "already_entitled", entitlementId: existing.id },
      { status: 409 },
    );
  }

  const amountCents = amountToCents(Number(cut.price));
  if (amountCents < 50) {
    console.error("[stripe checkout] listing price below Stripe Checkout minimum", {
      datacutId: cut.id,
      amountCents,
    });
    return NextResponse.json(
      { error: "This listing’s price is too low for checkout. Contact the creator." },
      { status: 400 },
    );
  }

  const fee = platformFeeCents(amountCents);
  const license = cut.license === "commercial" ? "commercial" : "personal";
  const origin = appOrigin();
  const successUrl = mobileReturnUrl
    ? mobileCheckoutBridgeUrl({
        to: mobileReturnUrl,
        status: "success",
        includeSessionPlaceholder: true,
      })
    : `${origin}/datacuts/${cut.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = mobileReturnUrl
    ? mobileCheckoutBridgeUrl({ to: mobileReturnUrl, status: "cancel" })
    : `${origin}/datacuts/${cut.slug}?checkout=cancel`;
  const stripe = getStripe();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle();

  try {
    // Destination charges + application_fee are incompatible with Managed Payments
    // (Dashboard may default it on). Opt out per session so Connect fees still work.
    // Decision: project store docs/stripe-managed-payments.md
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Stripe API: managed_payments[enabled]=false (SDK object form).
      managed_payments: { enabled: false },
      // Recovery / confirm: webhook + /api/stripe/confirm both key off this.
      client_reference_id: user.id,
      customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id
        ? undefined
        : profile?.email || user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: cut.title,
              description: licenseBlurb(license).slice(0, 400),
              metadata: {
                datacut_id: String(cut.id),
                datacut_slug: cut.slug,
              },
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: fee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
        // Fallback if Checkout Session metadata is sparse in a webhook payload.
        metadata: {
          user_id: user.id,
          datacut_id: String(cut.id),
          license,
          license_version: LICENSE_TEMPLATE_VERSION,
          creator_id: creator.id,
          stripe_account_id: creator.stripe_account_id,
          platform_fee_cents: String(fee),
        },
      },
      // Required by webhook / confirm: user_id + datacut_id (and fee/account for audit).
      metadata: {
        user_id: user.id,
        datacut_id: String(cut.id),
        license,
        license_version: LICENSE_TEMPLATE_VERSION,
        creator_id: creator.id,
        stripe_account_id: creator.stripe_account_id,
        platform_fee_cents: String(fee),
        platform_fee_percent: String(getPlatformFeePercent()),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout.sessions.create failed";
    console.error("[stripe checkout] session create failed", message);
    return NextResponse.json({ error: CHECKOUT_UNAVAILABLE }, { status: 502 });
  }
}
