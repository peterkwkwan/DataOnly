/**
 * Stripe env helpers. Secrets stay server-only; publishable key is public.
 * Values are never committed — see apps/web/.env.example and root README.
 */

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key || null;
}

export function getStripeWebhookSecret(): string | null {
  const key = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return key || null;
}

/** Platform fee as percent of listing price (default 10). Open product decision. */
export function getPlatformFeePercent(): number {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENT?.trim();
  if (!raw) return 10;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 10;
  return n;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey() && getStripePublishableKey());
}

export function appOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function amountToCents(priceUsd: number): number {
  return Math.round(Number(priceUsd) * 100);
}

export function platformFeeCents(amountCents: number, percent = getPlatformFeePercent()): number {
  return Math.round((amountCents * percent) / 100);
}
