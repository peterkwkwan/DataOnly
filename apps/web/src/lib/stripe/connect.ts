import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";

export type ConnectAccountFlags = {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
};

/** Default connected-account country (ISO 3166-1 alpha-2, lowercase). */
export function getConnectDefaultCountry(): string {
  const raw = process.env.STRIPE_CONNECT_DEFAULT_COUNTRY?.trim().toLowerCase();
  return raw && /^[a-z]{2}$/.test(raw) ? raw : "us";
}

/**
 * Maps Accounts v2 capabilities + requirements into the existing
 * creators.stripe_* boolean columns (checkout still gates on chargesEnabled).
 * Destination charges need stripe_transfers; Stripe also requires merchant
 * card_payments when requesting transfers on this platform.
 */
export function flagsFromV2Account(account: Stripe.V2.Core.Account): ConnectAccountFlags {
  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  // Destination Checkout needs transfers; card_payments is requested at create but not the gate.
  const chargesEnabled = transfersStatus === "active";

  const entries = account.requirements?.entries ?? [];
  const hasBlockingRequirement = entries.some((entry) => {
    const status = entry.minimum_deadline?.status;
    return status === "currently_due" || status === "past_due";
  });
  // No blocking requirements ⇒ form/KYC submitted (may still be pending Stripe review).
  const detailsSubmitted = !hasBlockingRequirement || chargesEnabled;
  const onboardingComplete = chargesEnabled && detailsSubmitted;

  return { chargesEnabled, detailsSubmitted, onboardingComplete };
}

/** Create a marketplace account (destination charges + Express Dashboard). */
export async function createConnectAccountV2(params: {
  email?: string | null;
  displayName: string;
  metadata: Record<string, string>;
}): Promise<{ accountId: string; flags: ConnectAccountFlags }> {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.create({
    contact_email: params.email || undefined,
    display_name: params.displayName,
    dashboard: "express",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
      profile: {
        doing_business_as: params.displayName,
        product_description: "DataOnly datacut marketplace creator",
      },
    },
    identity: {
      country: getConnectDefaultCountry(),
    },
    configuration: {
      // Stripe requires card_payments when requesting stripe_transfers (req_v2vfnEnJCuIzuq6jh).
      // Checkout remains destination charges on the platform (no on_behalf_of).
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: params.metadata,
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "identity",
      "requirements",
      "defaults",
    ],
  });

  return { accountId: account.id, flags: flagsFromV2Account(account) };
}

/** Stripe-hosted onboarding Account Link (v2). */
export async function createConnectOnboardingLinkV2(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const link = await stripe.v2.core.accountLinks.create({
    account: params.accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        collection_options: {
          fields: "eventually_due",
        },
      },
    },
  });
  return { url: link.url };
}

/** Refresh Connect flags from Accounts v2 (source of truth for recipient transfers). */
export async function retrieveConnectFlagsV2(
  accountId: string,
): Promise<ConnectAccountFlags> {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "requirements",
      "identity",
    ],
  });
  return flagsFromV2Account(account);
}
