import {
  asAsyncCatalog,
  createSupabaseCatalog,
  createSupabaseClient,
  mockCatalog,
  type AsyncCatalogRepository,
  type CatalogRepository,
} from "@dataonly/core";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Sync mock catalog for client components and offline fallback.
 * Prefer `getCatalog()` in Server Components when Supabase may be live.
 */
export const catalog: CatalogRepository = mockCatalog;

/**
 * Async catalog for public server pages.
 * Uses the publishable key without cookies (published rows are public under RLS).
 * Falls back to mock when env is missing or the probe query fails.
 */
export async function getCatalog(): Promise<AsyncCatalogRepository> {
  const env = getSupabasePublicEnv();
  if (!isSupabaseConfigured() || !env) {
    return asAsyncCatalog(mockCatalog);
  }

  try {
    const client = createSupabaseClient(env);
    const repo = createSupabaseCatalog(client);
    await repo.getCategories();
    return repo;
  } catch {
    return asAsyncCatalog(mockCatalog);
  }
}

export function usingLiveSupabase() {
  return isSupabaseConfigured();
}
