import type { Datacut, LicenseTemplate } from "./types";

export const EXPLORE_SORTS = ["popular", "newest", "rating", "price", "saved"] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export const DEFAULT_EXPLORE_SORT: ExploreSort = "popular";

export const EXPLORE_SORT_OPTIONS: { value: ExploreSort; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
  { value: "price", label: "Price: low to high" },
  { value: "saved", label: "Saved first" },
];

export type ExploreQuery = {
  sort: ExploreSort;
  formats: string[];
  licenses: LicenseTemplate[];
};

function isExploreSort(value: string): value is ExploreSort {
  return (EXPLORE_SORTS as readonly string[]).includes(value);
}

function uniquePreserve<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Parse explore query. Unknown sort → popular. Empty format/license = all. */
export function parseExploreQuery(params: {
  get(name: string): string | null;
  getAll(name: string): string[];
}): ExploreQuery {
  const sortRaw = params.get("sort") ?? "";
  const sort = isExploreSort(sortRaw) ? sortRaw : DEFAULT_EXPLORE_SORT;

  const formats = uniquePreserve(params.getAll("format").flatMap(splitList));

  const licenses = uniquePreserve(
    params
      .getAll("license")
      .flatMap(splitList)
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is LicenseTemplate => value === "personal" || value === "commercial"),
  );

  return { sort, formats, licenses };
}

/** Query string without leading `?`. Omits defaults (popular / empty filters). */
export function serializeExploreQuery(query: ExploreQuery): string {
  const params = new URLSearchParams();
  if (query.sort !== DEFAULT_EXPLORE_SORT) params.set("sort", query.sort);
  for (const format of query.formats) params.append("format", format);
  for (const license of query.licenses) params.append("license", license);
  return params.toString();
}

function comparePopular(a: Datacut, b: Datacut): number {
  return b.reviews - a.reviews || b.rating - a.rating;
}

function compareRating(a: Datacut, b: Datacut): number {
  return b.rating - a.rating || b.reviews - a.reviews;
}

function compareNewest(a: Datacut, b: Datacut): number {
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}

function comparePrice(a: Datacut, b: Datacut): number {
  return a.price - b.price;
}

function filterCuts(cuts: Datacut[], query: ExploreQuery): Datacut[] {
  const formatSet = query.formats.length
    ? new Set(query.formats.map((f) => f.toLowerCase()))
    : null;
  const licenseSet = query.licenses.length ? new Set(query.licenses) : null;

  return cuts.filter((cut) => {
    if (formatSet && !formatSet.has(cut.format.trim().toLowerCase())) return false;
    if (licenseSet && !licenseSet.has(cut.license)) return false;
    return true;
  });
}

function sortCuts(cuts: Datacut[], sort: ExploreSort, savedIds: number[]): Datacut[] {
  const saved = new Set(savedIds);
  const next = [...cuts];
  if (sort === "newest") {
    next.sort(compareNewest);
  } else if (sort === "rating") {
    next.sort(compareRating);
  } else if (sort === "price") {
    next.sort(comparePrice);
  } else if (sort === "saved") {
    next.sort((a, b) => {
      const aSaved = saved.has(a.id) ? 0 : 1;
      const bSaved = saved.has(b.id) ? 0 : 1;
      return aSaved - bSaved || comparePopular(a, b);
    });
  } else {
    next.sort(comparePopular);
  }
  return next;
}

/** Filter then sort. Empty formats/licenses leave the list intact. */
export function applyExploreQuery(
  cuts: Datacut[],
  query: ExploreQuery,
  savedIds: number[] = [],
): Datacut[] {
  return sortCuts(filterCuts(cuts, query), query.sort, savedIds);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`explore-query self-check: ${message}`);
}

/** Tiny assert check for the five sorts + empty filters. */
export function assertExploreQuery(): void {
  const stub = (partial: Partial<Datacut> & Pick<Datacut, "id">): Datacut =>
    ({
      slug: String(partial.id),
      title: String(partial.id),
      creatorId: "c",
      creatorName: "C",
      categoryId: "x",
      categoryName: "X",
      price: 0,
      rating: 0,
      reviews: 0,
      size: "",
      records: "",
      accent: "",
      art: "",
      updated: "",
      updatedAt: "2020-01-01T00:00:00.000Z",
      format: "CSV",
      license: "personal",
      licenseBlurb: "",
      description: "",
      ...partial,
    }) as Datacut;

  const cuts = [
    stub({ id: 1, price: 30, rating: 4, reviews: 10, updatedAt: "2026-01-01T00:00:00.000Z", format: "CSV" }),
    stub({ id: 2, price: 10, rating: 5, reviews: 2, updatedAt: "2026-06-01T00:00:00.000Z", format: "JSON" }),
    stub({ id: 3, price: 20, rating: 5, reviews: 8, updatedAt: "2026-03-01T00:00:00.000Z", format: "CSV", license: "commercial" }),
  ];

  const empty: ExploreQuery = { sort: "popular", formats: [], licenses: [] };
  assert(applyExploreQuery(cuts, empty).map((c) => c.id).join() === "1,3,2", "popular");
  assert(
    applyExploreQuery(cuts, { ...empty, sort: "newest" }).map((c) => c.id).join() === "2,3,1",
    "newest",
  );
  assert(
    applyExploreQuery(cuts, { ...empty, sort: "rating" }).map((c) => c.id).join() === "3,2,1",
    "rating",
  );
  assert(
    applyExploreQuery(cuts, { ...empty, sort: "price" }).map((c) => c.id).join() === "2,3,1",
    "price",
  );
  assert(
    applyExploreQuery(cuts, { ...empty, sort: "saved" }, [2]).map((c) => c.id).join() === "2,1,3",
    "saved",
  );
  assert(
    applyExploreQuery(cuts, { ...empty, formats: ["json"] }).map((c) => c.id).join() === "2",
    "format filter",
  );
  assert(parseExploreQuery(new URLSearchParams("sort=nope")).sort === "popular", "bad sort");
  assert(serializeExploreQuery(empty) === "", "default URL bare");
  assert(serializeExploreQuery({ ...empty, sort: "price" }) === "sort=price", "sort URL");
}

assertExploreQuery();
