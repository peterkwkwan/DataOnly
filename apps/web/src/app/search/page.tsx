import type { Metadata } from "next";
import Link from "next/link";
import { Verified } from "@/components/brand";
import { DatacutCard } from "@/components/datacut-card";
import { SearchBox } from "@/components/search-box";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Search",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const catalog = await getCatalog();
  const results = await catalog.search(q);
  const empty =
    q.trim().length > 0 &&
    results.datacuts.length === 0 &&
    results.creators.length === 0 &&
    results.categories.length === 0;
  const categories = await catalog.getCategories();
  const creators = await catalog.getCreators();

  return (
    <section className="search-page page-view">
      <div className="page-intro">
        <span className="kicker">Search</span>
        <h1>{q ? `Results for “${q}”` : "Search DataOnly"}</h1>
        <p>Search categories, industries, creators, and datacuts from the live or mock catalog.</p>
      </div>
      <SearchBox initialQuery={q} />
      {empty ? (
        <div className="m-empty-state">
          <h3>No matches</h3>
          <p>Try a popular category or verified creator.</p>
          <div className="filter-row" style={{ marginTop: 20 }}>
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/explore/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <div className="creator-store-grid" style={{ marginTop: 28 }}>
            {creators
              .filter((c) => c.verified)
              .map((creator, index) => (
                <Link
                  key={creator.id}
                  href={`/creators/${creator.slug}`}
                  className="creator-store"
                >
                  <div className={`store-cover cover-${(index % 3) + 1}`}>
                    <span>VERIFIED</span>
                    <div className="cover-shape" />
                  </div>
                  <div className="store-body">
                    <div className="large-avatar" style={{ background: creator.color }}>
                      {creator.initials}
                    </div>
                    <h2>{creator.name}</h2>
                    <Verified />
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ) : (
        <>
          {results.categories.length > 0 && (
            <>
              <div className="results-header">
                <div>
                  <h2>Categories</h2>
                  <span>{results.categories.length}</span>
                </div>
              </div>
              <div className="filter-row" style={{ marginBottom: 36 }}>
                {results.categories.map((c) => (
                  <Link key={c.id} href={`/explore/${c.slug}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
          {results.creators.length > 0 && (
            <>
              <div className="results-header">
                <div>
                  <h2>Creators</h2>
                  <span>{results.creators.length}</span>
                </div>
              </div>
              <div className="filter-row" style={{ marginBottom: 36 }}>
                {results.creators.map((c) => (
                  <Link key={c.id} href={`/creators/${c.slug}`}>
                    {c.name}
                    {c.verified ? " · Verified" : ""}
                  </Link>
                ))}
              </div>
            </>
          )}
          <div className="results-header">
            <div>
              <h2>Datacuts</h2>
              <span>{results.datacuts.length} results</span>
            </div>
          </div>
          <div className="datacut-grid page-grid">
            {results.datacuts.map((cut) => (
              <DatacutCard key={cut.id} cut={cut} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
