import {
  asAsyncCatalog,
  createSupabaseCatalog,
  createSupabaseClient,
  mockCatalog,
  type AsyncCatalogRepository,
  type CatalogRepository,
} from "@dataonly/core";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Sync mock catalog for client components and offline fallback.
 * Prefer `getCatalog()` in Server Components when Supabase may be live.
 */
export const catalog: CatalogRepository = mockCatalog;

/**
 * Async catalog for public server pages.
 * Uses the anon key without cookies (published rows are public under RLS).
 * Falls back to mock when env is missing or the probe query fails.
 */
export async function getCatalog(): Promise<AsyncCatalogRepository> {
  if (!isSupabaseConfigured()) {
    return asAsyncCatalog(mockCatalog);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const client = createSupabaseClient({ url, anonKey });
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
