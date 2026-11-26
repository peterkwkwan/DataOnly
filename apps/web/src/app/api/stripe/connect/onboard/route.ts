import { NextResponse } from "next/server";
import { appOrigin, isStripeConfigured } from "@/lib/stripe/config";
import {
  createConnectAccountV2,
  createConnectOnboardingLinkV2,
} from "@/lib/stripe/connect";
import { ensureCreatorForUser } from "@/lib/creator";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Creates (or reuses) a Stripe Connect account via Accounts v2
 * (recipient + Express Dashboard) and returns a v2 Account Link URL
 * for hosted onboarding / continuing KYC.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.",
        code: "stripe_not_configured",
        setupHint:
          "Open Stripe Dashboard → Connect (marketplace / destination charges). Then add keys to apps/web/.env.local.",
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

  let accountId = row.stripe_account_id as string | null;

  if (!accountId) {
    try {
      const created = await createConnectAccountV2({
        email: user.email,
        displayName: creator.name,
        metadata: {
          creator_id: creator.id,
          user_id: user.id,
        },
      });
      accountId = created.accountId;
      const { error: updateError } = await supabase
        .from("creators")
        .update({
          stripe_account_id: accountId,
          stripe_charges_enabled: created.flags.chargesEnabled,
          stripe_details_submitted: created.flags.detailsSubmitted,
          stripe_onboarding_complete: created.flags.onboardingComplete,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creator.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create Connect account";
      console.error("[stripe connect onboard] create", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const origin = appOrigin();
  try {
    const link = await createConnectOnboardingLinkV2({
      accountId,
      refreshUrl: `${origin}/account?connect=refresh`,
      returnUrl: `${origin}/account?connect=return`,
    });

    return NextResponse.json({
      url: link.url,
      accountId,
      chargesEnabled: row.stripe_charges_enabled,
      detailsSubmitted: row.stripe_details_submitted,
      onboardingComplete: row.stripe_onboarding_complete,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create Account Link";
    console.error("[stripe connect onboard] link", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
