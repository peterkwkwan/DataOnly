import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { retrieveConnectFlagsV2 } from "@/lib/stripe/connect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Refresh Connect account flags from Stripe (Accounts v2) after onboarding return. */
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

  try {
    const flags = await retrieveConnectFlagsV2(creator.stripe_account_id);

    const { error: updateError } = await supabase
      .from("creators")
      .update({
        stripe_charges_enabled: flags.chargesEnabled,
        stripe_details_submitted: flags.detailsSubmitted,
        stripe_onboarding_complete: flags.onboardingComplete,
        updated_at: new Date().toISOString(),
      })
      .eq("id", creator.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      configured: true,
      accountId: creator.stripe_account_id,
      chargesEnabled: flags.chargesEnabled,
      detailsSubmitted: flags.detailsSubmitted,
      onboardingComplete: flags.onboardingComplete,
      refreshed: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh Connect status";
    console.error("[stripe connect status]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
