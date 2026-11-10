import {
  categories,
  creators,
  datacuts,
  EXTRA_INDUSTRIES,
  INITIAL_SAVED_IDS,
} from "./mock-data";
import type {
  AutocompleteSuggestion,
  Category,
  Creator,
  Datacut,
} from "./types";

export interface CatalogRepository {
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
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export const mockCatalog: CatalogRepository = {
  getCategories() {
    return categories;
  },

  getCategoryBySlug(slug) {
    return categories.find((c) => c.slug === slug);
  },

  getCreators() {
    return creators;
  },

  getCreatorBySlug(slug) {
    return creators.find((c) => c.slug === slug);
  },

  getDatacuts(opts = {}) {
    return datacuts.filter((cut) => {
      if (opts.categoryId && cut.categoryId !== opts.categoryId) return false;
      if (opts.creatorId && cut.creatorId !== opts.creatorId) return false;
      return true;
    });
  },

  getDatacutBySlug(slug) {
    return datacuts.find((c) => c.slug === slug);
  },

  getPopularDatacuts(limit = 4) {
    return [...datacuts].sort((a, b) => b.reviews - a.reviews).slice(0, limit);
  },

  getTopDatacuts(limit = 4) {
    return [...datacuts].sort((a, b) => b.rating - a.rating).slice(0, limit);
  },

  searchAutocomplete(query) {
    const q = normalize(query);
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

  search(query) {
    const q = normalize(query);
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

  getInitialSavedIds() {
    return [...INITIAL_SAVED_IDS];
  },
};
