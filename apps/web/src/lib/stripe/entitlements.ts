import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export type CheckoutSessionMeta = {
  user_id: string;
  datacut_id: string;
  license?: string;
  license_version?: string;
  platform_fee_cents?: string;
  stripe_account_id?: string;
  creator_id?: string;
  platform_fee_percent?: string;
};

function asMeta(raw: Stripe.Metadata | null | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Resolve buyer/datacut metadata for entitlement writes.
 * Prefers Checkout Session metadata; falls back to PaymentIntent metadata
 * (both are set at session create — PI is a recovery path if session meta is sparse).
 */
export async function resolveCheckoutEntitlementMeta(
  session: Stripe.Checkout.Session,
): Promise<{ session: Stripe.Checkout.Session; meta: Record<string, string> }> {
  let current = session;
  let meta = asMeta(current.metadata);

  if (!meta.user_id || !meta.datacut_id) {
    const stripe = getStripe();
    current = await stripe.checkout.sessions.retrieve(session.id);
    meta = asMeta(current.metadata);
  }

  if (!meta.user_id || !meta.datacut_id) {
    const stripe = getStripe();
    const piRef = current.payment_intent;
    const piId = typeof piRef === "string" ? piRef : piRef?.id ?? null;
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId);
      // Session metadata wins over PI when both present.
      meta = { ...asMeta(pi.metadata), ...meta };
    }
  }

  return { session: current, meta };
}

export function parseEntitlementMeta(meta: Record<string, string>): {
  userId: string;
  datacutId: number;
  license: "personal" | "commercial";
  licenseVersion: string;
  platformFeeCents: number;
  stripeAccountId: string | null;
} {
  const userId = meta.user_id?.trim() || "";
  const datacutId = Number(meta.datacut_id);
  if (!userId || !Number.isFinite(datacutId) || datacutId <= 0) {
    throw new Error(
      "Checkout session missing user_id / datacut_id metadata (required for entitlements)",
    );
  }

  return {
    userId,
    datacutId,
    license: meta.license === "commercial" ? "commercial" : "personal",
    licenseVersion: meta.license_version?.trim() || "v1",
    platformFeeCents: Number(meta.platform_fee_cents || 0),
    stripeAccountId: meta.stripe_account_id?.trim() || null,
  };
}

/**
 * Upsert an active entitlement from a paid/complete Checkout Session.
 * Uses the Supabase service role (bypasses RLS). Callers must verify the
 * session is paid/complete and that the acting principal may grant it.
 */
export async function upsertEntitlementFromSession(
  sessionInput: Stripe.Checkout.Session,
): Promise<{ entitlementUserId: string; datacutId: number; sessionId: string }> {
  const { session, meta } = await resolveCheckoutEntitlementMeta(sessionInput);
  const parsed = parseEntitlementMeta(meta);

  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : 0;
  const currency = session.currency || "usd";
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const admin = createServiceSupabaseClient();

  if (session.customer && typeof session.customer === "string") {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ stripe_customer_id: session.customer })
      .eq("id", parsed.userId)
      .is("stripe_customer_id", null);
    if (profileError) {
      // Non-fatal: entitlement still proceeds. Log for ops.
      console.warn(
        "[stripe entitlements] profiles.stripe_customer_id update failed:",
        profileError.message,
      );
    }
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      user_id: parsed.userId,
      datacut_id: parsed.datacutId,
      license: parsed.license,
      license_version: parsed.licenseVersion,
      amount_cents: amountCents,
      currency,
      platform_fee_cents: Number.isFinite(parsed.platformFeeCents)
        ? parsed.platformFeeCents
        : 0,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      stripe_account_id: parsed.stripeAccountId,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,datacut_id" },
  );

  if (error) {
    throw new Error(
      `entitlements upsert failed (${error.code ?? "unknown"}): ${error.message}`,
    );
  }

  return {
    entitlementUserId: parsed.userId,
    datacutId: parsed.datacutId,
    sessionId: session.id,
  };
}

export function sessionLooksPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}
