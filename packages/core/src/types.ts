export type IndustryIconName =
  | "finance"
  | "healthcare"
  | "engineering"
  | "culinary"
  | "energy"
  | "fitness";

export type LicenseTemplate = "personal" | "commercial";

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
  /** v0: mock verified creators only — no real apply form */
  verified: boolean;
  bio: string;
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
}

export interface AutocompleteSuggestion {
  kind: "category" | "industry" | "datacut" | "creator";
  label: string;
  href: string;
  subtitle?: string;
}
