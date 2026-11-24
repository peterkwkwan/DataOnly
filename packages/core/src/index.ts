export type {
  AutocompleteSuggestion,
  Category,
  Creator,
  Datacut,
  DatacutWriteInput,
  Entitlement,
  EntitlementStatus,
  IndustryIconName,
  LicenseTemplate,
  ListingStatus,
  Profile,
  ProfileRole,
  SupabasePublicEnv,
  VerificationApplication,
  VerificationStatus,
  VerifiedSource,
  VerifiedSourcePlatform,
} from "./types";
export {
  LICENSE_SUMMARIES,
  LICENSE_TEMPLATE_VERSION,
  licenseVersionLabel,
} from "./licensing";
export {
  categories,
  creators,
  datacuts,
  EXTRA_INDUSTRIES,
  INITIAL_SAVED_IDS,
} from "./mock-data";
export { mockCatalog } from "./repository";
export type { CatalogRepository } from "./repository";
export { hasSupabaseEnv, resolveSupabaseEnv } from "./supabase/env";
export { createSupabaseClient } from "./supabase/client";
export {
  asAsyncCatalog,
  createSupabaseCatalog,
} from "./supabase/catalog";
export type { AsyncCatalogRepository } from "./supabase/catalog";
export {
  licenseBlurb,
  mapCategory,
  mapCreator,
  mapDatacut,
  mapEntitlement,
  mapProfile,
  mapVerification,
} from "./supabase/mappers";
export type {
  CategoryRow,
  CreatorRow,
  DatacutRow,
  EntitlementRow,
  ProfileRow,
  VerificationRow,
} from "./supabase/mappers";
export {
  emptyVerifiedSourceRow,
  isVerifiedSourcePlatform,
  isVerifiedSourceUrlValid,
  normalizeVerifiedSourceUrl,
  parseVerifiedSources,
  validateVerifiedSources,
  verifiedSourcePlatformLabel,
  VERIFIED_SOURCE_PLATFORMS,
} from "./verified-sources";
export type { VerifiedSourcesValidation } from "./verified-sources";
export { ensureCreatorForUser } from "./supabase/creator";
export {
  CREATOR_TOS_ACCEPT_LABEL,
  CREATOR_TOS_DRAFT_NOTICE,
  CREATOR_TOS_SECTIONS,
  CREATOR_TOS_VERSION,
  acceptCreatorTos,
  hasAcceptedCreatorTos,
} from "./creator-tos";
export type { CreatorTosSection } from "./creator-tos";
