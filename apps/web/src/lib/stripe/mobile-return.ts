import { appOrigin } from "@/lib/stripe/config";

const MOBILE_SCHEMES = new Set(["dataonlymobile:", "exp:", "exps:"]);

/**
 * Allow only app deep links (Expo scheme / Expo Go) as Checkout return bases.
 * Rejects http(s) open-redirect targets — those use the normal web success_url.
 */
export function isAllowedMobileReturnUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return MOBILE_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

/**
 * HTTPS bridge Stripe hits after Checkout; the page then deep-links into the app.
 * `to` is the mobile base URL from Linking.createURL (no query string).
 */
export function mobileCheckoutBridgeUrl(opts: {
  to: string;
  status: "success" | "cancel";
  includeSessionPlaceholder?: boolean;
}): string {
  const origin = appOrigin();
  const params = new URLSearchParams({
    to: opts.to,
    status: opts.status,
  });
  // Append session placeholder unencoded — Stripe replaces `{CHECKOUT_SESSION_ID}` literally.
  const base = `${origin}/mobile/checkout-return?${params.toString()}`;
  return opts.includeSessionPlaceholder
    ? `${base}&session_id={CHECKOUT_SESSION_ID}`
    : base;
}
