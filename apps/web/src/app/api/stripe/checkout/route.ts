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
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  datacutId?: number;
};

/**
 * Creates a Stripe Checkout Session for a published datacut.
 * Destination charge → creator Connect account + platform application fee.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.",
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

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    return NextResponse.json({ error: cutError.message }, { status: 500 });
  }
  if (!cut || cut.status !== "published") {
    return NextResponse.json({ error: "Datacut not available for purchase" }, { status: 404 });
  }

  const creatorRel = cut.creators;
  const creator = Array.isArray(creatorRel) ? creatorRel[0] : creatorRel;
  if (!creator?.stripe_account_id || !creator.stripe_charges_enabled) {
    return NextResponse.json(
      {
        error:
          "This creator has not finished Stripe Connect onboarding, so checkout is unavailable.",
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
    return NextResponse.json(
      { error: "Listing price must be at least $0.50 for Stripe Checkout" },
      { status: 400 },
    );
  }

  const fee = platformFeeCents(amountCents);
  const license = cut.license === "commercial" ? "commercial" : "personal";
  const origin = appOrigin();
  const stripe = getStripe();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: profile?.stripe_customer_id || undefined,
    customer_email: profile?.stripe_customer_id ? undefined : profile?.email || user.email || undefined,
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
      metadata: {
        user_id: user.id,
        datacut_id: String(cut.id),
        license,
        license_version: LICENSE_TEMPLATE_VERSION,
      },
    },
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
    success_url: `${origin}/datacuts/${cut.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/datacuts/${cut.slug}?checkout=cancel`,
  });

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
  });
}
