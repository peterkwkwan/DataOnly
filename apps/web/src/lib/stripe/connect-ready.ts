/**
 * Same gate as Checkout destination charges: Connect account id set and
 * charges/transfers enabled (creators.stripe_charges_enabled).
 */
export function isCreatorConnectReady(
  accountId: string | null | undefined,
  chargesEnabled: boolean | null | undefined,
): boolean {
  return Boolean(accountId?.trim()) && Boolean(chargesEnabled);
}

export const PUBLISH_REQUIRES_PAYOUTS =
  "Set up payouts before publishing. Drafts can be saved anytime.";

function assertConnectReady() {
  if (
    !isCreatorConnectReady("acct_x", true) ||
    isCreatorConnectReady(null, true) ||
    isCreatorConnectReady("acct_x", false) ||
    isCreatorConnectReady("  ", true) ||
    isCreatorConnectReady("", false)
  ) {
    throw new Error("isCreatorConnectReady");
  }
}
assertConnectReady();
