import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/stripe/config";

let cached: Stripe | null = null;

/** Server-only Stripe SDK. Throws when STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!cached) {
    cached = new Stripe(key, {
      // Pin to the SDK's bundled default; bump intentionally with stripe upgrades.
      apiVersion: "2026-11-18.endive",
      typescript: true,
    });
  }
  return cached;
}
