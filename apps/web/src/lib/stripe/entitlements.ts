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

  const { data: existing, error: existingError } = await admin
    .from("entitlements")
    .select("status, stripe_checkout_session_id")
    .eq("user_id", parsed.userId)
    .eq("datacut_id", parsed.datacutId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `entitlements lookup failed (${existingError.code ?? "unknown"}): ${existingError.message}`,
    );
  }

  // Checkout 409 blocks a second session while access is active. If one still arrives, keep the current grant and its receipt.
  if (existing?.status === "active" && existing.stripe_checkout_session_id !== session.id) {
    console.info(
      `[stripe entitlements] skip active entitlement user=${parsed.userId} datacut=${parsed.datacutId} session=${session.id}`,
    );
    return {
      entitlementUserId: parsed.userId,
      datacutId: parsed.datacutId,
      sessionId: session.id,
    };
  }

  const { error: purchaseError } = await admin.from("purchases").insert({
    user_id: parsed.userId,
    datacut_id: parsed.datacutId,
    license: parsed.license,
    amount_cents: amountCents,
    currency,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntent,
    status: "paid",
  });
  if (purchaseError && purchaseError.code !== "23505") {
    throw new Error(
      `purchases insert failed (${purchaseError.code ?? "unknown"}): ${purchaseError.message}`,
    );
  }

  const openNewAccess =
    !existing || existing.status === "refunded" || existing.status === "revoked";

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
      ...(openNewAccess ? { downloaded_at: null } : {}),
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

/**
 * Mark the ledger row for a PaymentIntent refunded, then the entitlement
 * only when that payment is still the current access charge (active/pending).
 * Used by webhook (`charge.refunded` / `payment_intent.refunded`) and the admin refund API.
 */
export async function markEntitlementRefundedByPaymentIntent(
  paymentIntentId: string,
): Promise<{ updated: number; entitlementIds: string[] }> {
  const piId = paymentIntentId?.trim();
  if (!piId) {
    return { updated: 0, entitlementIds: [] };
  }

  const admin = createServiceSupabaseClient();
  const { error: purchaseError } = await admin
    .from("purchases")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", piId);

  if (purchaseError) {
    throw new Error(
      `purchases refund update failed (${purchaseError.code ?? "unknown"}): ${purchaseError.message}`,
    );
  }

  const { data, error } = await admin
    .from("entitlements")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", piId)
    .in("status", ["active", "pending"])
    .select("id, user_id, datacut_id");

  if (error) {
    throw new Error(
      `entitlements refund update failed (${error.code ?? "unknown"}): ${error.message}`,
    );
  }

  const rows = data ?? [];
  for (const row of rows) {
    const userId = row.user_id as string;
    const datacutId = Number(row.datacut_id);
    if (!userId || !Number.isFinite(datacutId)) continue;
    const { error: hideError } = await admin
      .from("reviews")
      .update({
        visible: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("datacut_id", datacutId)
      .eq("visible", true);
    if (hideError) {
      console.warn(
        "[stripe entitlements] hide review after refund failed:",
        hideError.message,
      );
    }
  }

  const entitlementIds = rows.map((row) => row.id as string);
  return { updated: entitlementIds.length, entitlementIds };
}
