#!/usr/bin/env node
/**
 * Backfill an entitlements row from an existing Stripe Checkout Session.
 *
 * Use when Checkout succeeded (cs_test_… / cs_live_…) but `entitlements` is empty
 * because the webhook never landed (stripe listen down, wrong whsec, missing
 * SUPABASE_SERVICE_ROLE_KEY, etc.).
 *
 * Usage (from repo root, with apps/web/.env.local loaded or env exported):
 *
 *   node --env-file=apps/web/.env.local scripts/backfill-entitlement.mjs cs_test_...
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Session must be paid/complete and must carry metadata.user_id + metadata.datacut_id
 * (set by POST /api/stripe/checkout).
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const sessionId = process.argv[2]?.trim();
if (!sessionId?.startsWith("cs_")) {
  console.error("Usage: node scripts/backfill-entitlement.mjs <cs_test_…|cs_live_…>");
  process.exit(1);
}

const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!stripeKey || !supabaseUrl || !serviceKey) {
  console.error(
    "Missing env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const session = await stripe.checkout.sessions.retrieve(sessionId);
const paid = session.payment_status === "paid" || session.status === "complete";
if (!paid) {
  console.error(
    `Session ${sessionId} is not paid/complete (payment_status=${session.payment_status}, status=${session.status})`,
  );
  process.exit(1);
}

let meta = { ...(session.metadata || {}) };
if (!meta.user_id || !meta.datacut_id) {
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId);
    meta = { ...(pi.metadata || {}), ...meta };
  }
}

const userId = meta.user_id?.trim();
const datacutId = Number(meta.datacut_id);
if (!userId || !Number.isFinite(datacutId) || datacutId <= 0) {
  console.error(
    `Session ${sessionId} missing metadata.user_id / metadata.datacut_id. Cannot backfill.`,
  );
  console.error("metadata:", meta);
  process.exit(1);
}

const license = meta.license === "commercial" ? "commercial" : "personal";
const licenseVersion = meta.license_version?.trim() || "v1";
const platformFeeCents = Number(meta.platform_fee_cents || 0);
const paymentIntent =
  typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

const row = {
  user_id: userId,
  datacut_id: datacutId,
  license,
  license_version: licenseVersion,
  amount_cents: typeof session.amount_total === "number" ? session.amount_total : 0,
  currency: session.currency || "usd",
  platform_fee_cents: Number.isFinite(platformFeeCents) ? platformFeeCents : 0,
  stripe_checkout_session_id: session.id,
  stripe_payment_intent_id: paymentIntent,
  stripe_account_id: meta.stripe_account_id?.trim() || null,
  status: "active",
  updated_at: new Date().toISOString(),
};

const { data, error } = await admin
  .from("entitlements")
  .upsert(row, { onConflict: "user_id,datacut_id" })
  .select("id, user_id, datacut_id, status, stripe_checkout_session_id")
  .maybeSingle();

if (error) {
  console.error("Upsert failed:", error.message, error);
  process.exit(1);
}

console.log("Entitlement upserted:");
console.log(JSON.stringify(data, null, 2));
