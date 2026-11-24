import type {
  Category,
  Creator,
  Datacut,
  Entitlement,
  EntitlementStatus,
  IndustryIconName,
  LicenseTemplate,
  ListingStatus,
  Profile,
  ProfileRole,
  VerificationApplication,
  VerificationStatus,
} from "../types";
import { parseVerifiedSources } from "../verified-sources";

const PERSONAL_BLURB =
  "Personal Use — private / non-commercial use by the buyer. No resale, sublicensing, or commercial product use.";
const COMMERCIAL_BLURB =
  "Commercial Use — use inside the buyer’s business / products as stated on this listing. No redistribution as a competing dataset.";

export function licenseBlurb(license: LicenseTemplate): string {
  return license === "commercial" ? COMMERCIAL_BLURB : PERSONAL_BLURB;
}

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  count: string;
  icon: string;
  color: string;
  blurb: string;
};

export type CreatorRow = {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  specialty: string;
  cuts: number;
  followers: string;
  initials: string;
  color: string;
  verified: boolean;
  bio: string;
  verified_at: string | null;
  revoked_at: string | null;
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean | null;
  stripe_details_submitted?: boolean | null;
  stripe_onboarding_complete?: boolean | null;
};

export type EntitlementRow = {
  id: string;
  user_id: string;
  datacut_id: number;
  license: string;
  license_version: string;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_account_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DatacutRow = {
  id: number;
  slug: string;
  title: string;
  creator_id: string;
  category_id: string;
  price: number;
  rating: number;
  reviews: number;
  size: string;
  records: string;
  accent: string;
  art: string;
  updated_label: string;
  format: string;
  license: string;
  description: string;
  status: string;
  creators?:
    | { name: string; verified?: boolean | null }
    | { name: string; verified?: boolean | null }[]
    | null;
  categories?: { name: string } | { name: string }[] | null;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  tos_accepted_at?: string | null;
  tos_version?: string | null;
  created_at: string;
};

export type VerificationRow = {
  id: string;
  creator_id: string;
  status: string;
  identity: string;
  industries: string[] | null;
  portfolio_links: string[] | null;
  sources?: unknown;
  credentials: string | null;
  attestation_accepted_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  info_request_note: string | null;
  created_at: string;
  updated_at: string;
};

function oneName(
  rel: { name: string } | { name: string }[] | null | undefined,
  fallback: string,
): string {
  if (!rel) return fallback;
  if (Array.isArray(rel)) return rel[0]?.name ?? fallback;
  return rel.name ?? fallback;
}

function oneVerified(
  rel:
    | { verified?: boolean | null }
    | { verified?: boolean | null }[]
    | null
    | undefined,
): boolean {
  if (!rel) return false;
  if (Array.isArray(rel)) return !!rel[0]?.verified;
  return !!rel.verified;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    count: row.count,
    icon: row.icon as IndustryIconName,
    color: row.color,
    blurb: row.blurb,
  };
}

export function mapCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    specialty: row.specialty,
    cuts: row.cuts,
    followers: row.followers,
    initials: row.initials,
    color: row.color,
    verified: row.verified,
    bio: row.bio,
    verifiedAt: row.verified_at,
    revokedAt: row.revoked_at,
    stripeAccountId: row.stripe_account_id ?? null,
    stripeChargesEnabled: !!row.stripe_charges_enabled,
    stripeDetailsSubmitted: !!row.stripe_details_submitted,
    stripeOnboardingComplete: !!row.stripe_onboarding_complete,
  };
}

export function mapEntitlement(row: EntitlementRow): Entitlement {
  const license = (row.license === "commercial" ? "commercial" : "personal") as LicenseTemplate;
  return {
    id: row.id,
    userId: row.user_id,
    datacutId: Number(row.datacut_id),
    license,
    licenseVersion: row.license_version,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    platformFeeCents: Number(row.platform_fee_cents),
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeAccountId: row.stripe_account_id,
    status: (row.status as EntitlementStatus) || "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDatacut(row: DatacutRow): Datacut {
  const license = (row.license === "commercial" ? "commercial" : "personal") as LicenseTemplate;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    creatorId: row.creator_id,
    creatorName: oneName(row.creators, "Unknown creator"),
    creatorVerified: oneVerified(row.creators),
    categoryId: row.category_id,
    categoryName: oneName(row.categories, "Uncategorized"),
    price: Number(row.price),
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    size: row.size,
    records: row.records,
    accent: row.accent,
    art: row.art,
    updated: row.updated_label,
    format: row.format,
    license,
    licenseBlurb: licenseBlurb(license),
    description: row.description,
    status: (row.status === "draft" ? "draft" : "published") as ListingStatus,
  };
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: (row.role as ProfileRole) || "user",
    tosAcceptedAt: row.tos_accepted_at ?? null,
    tosVersion: row.tos_version ?? null,
    createdAt: row.created_at,
  };
}

export function mapVerification(row: VerificationRow): VerificationApplication {
  return {
    id: row.id,
    creatorId: row.creator_id,
    status: row.status as VerificationStatus,
    identity: row.identity,
    industries: row.industries ?? [],
    portfolioLinks: row.portfolio_links ?? [],
    sources: parseVerifiedSources(row.sources),
    credentials: row.credentials,
    attestationAcceptedAt: row.attestation_accepted_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    rejectionReason: row.rejection_reason,
    infoRequestNote: row.info_request_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
