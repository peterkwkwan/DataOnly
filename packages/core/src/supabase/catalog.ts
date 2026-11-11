import type { SupabaseClient } from "@supabase/supabase-js";
import { EXTRA_INDUSTRIES } from "../mock-data";
import type {
  AutocompleteSuggestion,
  Category,
  Creator,
  Datacut,
} from "../types";
import {
  mapCategory,
  mapCreator,
  mapDatacut,
  type CategoryRow,
  type CreatorRow,
  type DatacutRow,
} from "./mappers";

export interface AsyncCatalogRepository {
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getCreators(): Promise<Creator[]>;
  getCreatorBySlug(slug: string): Promise<Creator | undefined>;
  getDatacuts(opts?: {
    categoryId?: string;
    creatorId?: string;
    includeDrafts?: boolean;
  }): Promise<Datacut[]>;
  getDatacutBySlug(slug: string): Promise<Datacut | undefined>;
  getPopularDatacuts(limit?: number): Promise<Datacut[]>;
  getTopDatacuts(limit?: number): Promise<Datacut[]>;
  searchAutocomplete(query: string): Promise<AutocompleteSuggestion[]>;
  search(query: string): Promise<{
    datacuts: Datacut[];
    creators: Creator[];
    categories: Category[];
  }>;
  getInitialSavedIds(): Promise<number[]>;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

const DATACUT_SELECT =
  "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, creators(name), categories(name)";

export function createSupabaseCatalog(client: SupabaseClient): AsyncCatalogRepository {
  async function loadPublished(opts: {
    categoryId?: string;
    creatorId?: string;
  } = {}): Promise<Datacut[]> {
    let query = client.from("datacuts").select(DATACUT_SELECT).eq("status", "published");
    if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
    if (opts.creatorId) query = query.eq("creator_id", opts.creatorId);
    const { data, error } = await query.order("id", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DatacutRow[]).map(mapDatacut);
  }

  return {
    async getCategories() {
      const { data, error } = await client.from("categories").select("*").order("name");
      if (error) throw error;
      return ((data ?? []) as CategoryRow[]).map(mapCategory);
    },

    async getCategoryBySlug(slug) {
      const { data, error } = await client.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data ? mapCategory(data as CategoryRow) : undefined;
    },

    async getCreators() {
      const { data, error } = await client.from("creators").select("*").order("name");
      if (error) throw error;
      return ((data ?? []) as CreatorRow[]).map(mapCreator);
    },

    async getCreatorBySlug(slug) {
      const { data, error } = await client.from("creators").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data ? mapCreator(data as CreatorRow) : undefined;
    },

    async getDatacuts(opts = {}) {
      if (opts.includeDrafts) {
        let query = client.from("datacuts").select(DATACUT_SELECT);
        if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
        if (opts.creatorId) query = query.eq("creator_id", opts.creatorId);
        const { data, error } = await query.order("id", { ascending: true });
        if (error) throw error;
        return ((data ?? []) as DatacutRow[]).map(mapDatacut);
      }
      return loadPublished(opts);
    },

    async getDatacutBySlug(slug) {
      const { data, error } = await client
        .from("datacuts")
        .select(DATACUT_SELECT)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? mapDatacut(data as DatacutRow) : undefined;
    },

    async getPopularDatacuts(limit = 4) {
      const cuts = await loadPublished();
      return [...cuts].sort((a, b) => b.reviews - a.reviews).slice(0, limit);
    },

    async getTopDatacuts(limit = 4) {
      const cuts = await loadPublished();
      return [...cuts].sort((a, b) => b.rating - a.rating).slice(0, limit);
    },

    async searchAutocomplete(query) {
      const q = normalize(query);
      const [categories, creators, datacuts] = await Promise.all([
        this.getCategories(),
        this.getCreators(),
        loadPublished(),
      ]);
      const suggestions: AutocompleteSuggestion[] = [];

      for (const category of categories) {
        if (!q || normalize(category.name).includes(q)) {
          suggestions.push({
            kind: "category",
            label: category.name,
            href: `/explore/${category.slug}`,
            subtitle: `${category.count} datacuts`,
          });
        }
      }

      for (const industry of EXTRA_INDUSTRIES) {
        if (!q || normalize(industry).includes(q)) {
          if (!suggestions.some((s) => normalize(s.label) === normalize(industry))) {
            suggestions.push({
              kind: "industry",
              label: industry,
              href: `/search?q=${encodeURIComponent(industry)}`,
              subtitle: `Browse ${industry.toLowerCase()} data`,
            });
          }
        }
      }

      if (q) {
        for (const cut of datacuts) {
          if (normalize(cut.title).includes(q)) {
            suggestions.push({
              kind: "datacut",
              label: cut.title,
              href: `/datacuts/${cut.slug}`,
              subtitle: cut.creatorName,
            });
          }
        }
        for (const creator of creators) {
          if (normalize(creator.name).includes(q)) {
            suggestions.push({
              kind: "creator",
              label: creator.name,
              href: `/creators/${creator.slug}`,
              subtitle: creator.specialty,
            });
          }
        }
      }

      return suggestions.slice(0, 8);
    },

    async search(query) {
      const q = normalize(query);
      const [categories, creators, datacuts] = await Promise.all([
        this.getCategories(),
        this.getCreators(),
        loadPublished(),
      ]);
      if (!q) {
        return {
          datacuts: datacuts.slice(0, 4),
          creators: creators.filter((c) => c.verified).slice(0, 3),
          categories: categories.slice(0, 4),
        };
      }
      return {
        datacuts: datacuts.filter(
          (c) =>
            normalize(c.title).includes(q) ||
            normalize(c.categoryName).includes(q) ||
            normalize(c.creatorName).includes(q) ||
            normalize(c.description).includes(q),
        ),
        creators: creators.filter(
          (c) =>
            normalize(c.name).includes(q) ||
            normalize(c.specialty).includes(q) ||
            normalize(c.bio).includes(q),
        ),
        categories: categories.filter(
          (c) => normalize(c.name).includes(q) || normalize(c.blurb).includes(q),
        ),
      };
    },

    async getInitialSavedIds() {
      return [];
    },
  };
}

/** Adapt sync mock catalog to the async interface. */
export function asAsyncCatalog(sync: {
  getCategories(): Category[];
  getCategoryBySlug(slug: string): Category | undefined;
  getCreators(): Creator[];
  getCreatorBySlug(slug: string): Creator | undefined;
  getDatacuts(opts?: { categoryId?: string; creatorId?: string }): Datacut[];
  getDatacutBySlug(slug: string): Datacut | undefined;
  getPopularDatacuts(limit?: number): Datacut[];
  getTopDatacuts(limit?: number): Datacut[];
  searchAutocomplete(query: string): AutocompleteSuggestion[];
  search(query: string): { datacuts: Datacut[]; creators: Creator[]; categories: Category[] };
  getInitialSavedIds(): number[];
}): AsyncCatalogRepository {
  return {
    getCategories: async () => sync.getCategories(),
    getCategoryBySlug: async (slug) => sync.getCategoryBySlug(slug),
    getCreators: async () => sync.getCreators(),
    getCreatorBySlug: async (slug) => sync.getCreatorBySlug(slug),
    getDatacuts: async (opts) => sync.getDatacuts(opts),
    getDatacutBySlug: async (slug) => sync.getDatacutBySlug(slug),
    getPopularDatacuts: async (limit) => sync.getPopularDatacuts(limit),
    getTopDatacuts: async (limit) => sync.getTopDatacuts(limit),
    searchAutocomplete: async (query) => sync.searchAutocomplete(query),
    search: async (query) => sync.search(query),
    getInitialSavedIds: async () => sync.getInitialSavedIds(),
  };
}
