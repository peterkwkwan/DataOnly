import type {
  Category,
  Creator,
  Datacut,
  IndustryIconName,
  LicenseTemplate,
  ListingStatus,
  Profile,
  ProfileRole,
  VerificationApplication,
  VerificationStatus,
} from "../types";

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
  creators?: { name: string } | { name: string }[] | null;
  categories?: { name: string } | { name: string }[] | null;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

export type VerificationRow = {
  id: string;
  creator_id: string;
  status: string;
  identity: string;
  industries: string[] | null;
  portfolio_links: string[] | null;
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
