export type IndustryIconName =
  | "finance"
  | "healthcare"
  | "engineering"
  | "culinary"
  | "energy"
  | "fitness";

export type LicenseTemplate = "personal" | "commercial";

export type ListingStatus = "draft" | "published";

export type VerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_more_info"
  | "approved"
  | "rejected"
  | "revoked";

export type ProfileRole = "user" | "creator" | "admin";

export interface Category {
  id: string;
  name: string;
  slug: string;
  count: string;
  icon: IndustryIconName;
  color: string;
  blurb: string;
}

export interface Creator {
  id: string;
  name: string;
  slug: string;
  specialty: string;
  cuts: number;
  followers: string;
  initials: string;
  color: string;
  /** Verified badge from application flow or admin override */
  verified: boolean;
  bio: string;
  /** Linked auth user when creator owns an account (Alpha+) */
  userId?: string | null;
  verifiedAt?: string | null;
  revokedAt?: string | null;
}

export interface Datacut {
  id: number;
  slug: string;
  title: string;
  creatorId: string;
  creatorName: string;
  categoryId: string;
  categoryName: string;
  price: number;
  rating: number;
  reviews: number;
  size: string;
  records: string;
  accent: string;
  art: string;
  updated: string;
  format: string;
  license: LicenseTemplate;
  licenseBlurb: string;
  description: string;
  /** Public catalog only includes published; owners see drafts in dashboard */
  status?: ListingStatus;
}

export interface AutocompleteSuggestion {
  kind: "category" | "industry" | "datacut" | "creator";
  label: string;
  href: string;
  subtitle?: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  email: string | null;
  role: ProfileRole;
  createdAt: string;
}

export interface VerificationApplication {
  id: string;
  creatorId: string;
  status: VerificationStatus;
  identity: string;
  industries: string[];
  portfolioLinks: string[];
  credentials: string | null;
  attestationAcceptedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  infoRequestNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatacutWriteInput {
  title: string;
  slug: string;
  categoryId: string;
  price: number;
  size: string;
  records: string;
  format: string;
  license: LicenseTemplate;
  description: string;
  accent?: string;
  art?: string;
  status?: ListingStatus;
}

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}
