import { NextResponse } from "next/server";
import { appOrigin, isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import { ensureCreatorForUser } from "@/lib/creator";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Creates (or reuses) a Stripe Express account for the signed-in creator
 * and returns an Account Link URL for onboarding / continuing KYC.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.",
        code: "stripe_not_configured",
        setupHint:
          "Open Stripe Dashboard → Connect → Get started (Express). Then add keys to apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const creator = await ensureCreatorForUser(supabase, user, profile?.display_name);

  const { data: row, error: rowError } = await supabase
    .from("creators")
    .select(
      "id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_onboarding_complete",
    )
    .eq("id", creator.id)
    .single();

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  const stripe = getStripe();
  let accountId = row.stripe_account_id as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: creator.name,
        product_description: "DataOnly datacut marketplace creator",
      },
      metadata: {
        creator_id: creator.id,
        user_id: user.id,
      },
    });
    accountId = account.id;
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        stripe_account_id: accountId,
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_details_submitted: !!account.details_submitted,
        stripe_onboarding_complete: !!(account.charges_enabled && account.details_submitted),
        updated_at: new Date().toISOString(),
      })
      .eq("id", creator.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const origin = appOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard?connect=refresh`,
    return_url: `${origin}/dashboard?connect=return`,
    type: "account_onboarding",
  });

  return NextResponse.json({
    url: link.url,
    accountId,
    chargesEnabled: row.stripe_charges_enabled,
    detailsSubmitted: row.stripe_details_submitted,
    onboardingComplete: row.stripe_onboarding_complete,
  });
}
