import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Refresh Connect account flags from Stripe after onboarding return. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: creator, error } = await supabase
    .from("creators")
    .select(
      "id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_onboarding_complete",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!creator) {
    return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
  }

  if (!isStripeConfigured() || !creator.stripe_account_id) {
    return NextResponse.json({
      configured: isStripeConfigured(),
      accountId: creator.stripe_account_id,
      chargesEnabled: !!creator.stripe_charges_enabled,
      detailsSubmitted: !!creator.stripe_details_submitted,
      onboardingComplete: !!creator.stripe_onboarding_complete,
      refreshed: false,
    });
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(creator.stripe_account_id);
  const chargesEnabled = !!account.charges_enabled;
  const detailsSubmitted = !!account.details_submitted;
  const onboardingComplete = chargesEnabled && detailsSubmitted;

  const { error: updateError } = await supabase
    .from("creators")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_details_submitted: detailsSubmitted,
      stripe_onboarding_complete: onboardingComplete,
      updated_at: new Date().toISOString(),
    })
    .eq("id", creator.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    configured: true,
    accountId: creator.stripe_account_id,
    chargesEnabled,
    detailsSubmitted,
    onboardingComplete,
    refreshed: true,
  });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: creator, error } = await supabase
    .from("creators")
    .select(
      "id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_onboarding_complete",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    configured: isStripeConfigured(),
    accountId: creator?.stripe_account_id ?? null,
    chargesEnabled: !!creator?.stripe_charges_enabled,
    detailsSubmitted: !!creator?.stripe_details_submitted,
    onboardingComplete: !!creator?.stripe_onboarding_complete,
  });
}
