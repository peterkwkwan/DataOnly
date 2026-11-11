import type { Metadata } from "next";
import Link from "next/link";
import { DatacutCard } from "@/components/datacut-card";
import { Icon } from "@/components/icons";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Explore",
};

export default async function ExplorePage() {
  const catalog = await getCatalog();
  const categories = await catalog.getCategories();
  const cuts = await catalog.getTopDatacuts(8);

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Marketplace categories</span>
        <h1>Explore data by industry.</h1>
        <p>
          From specialized research to real-world observations, find the right data for your next
          project.
        </p>
      </div>
      <div className="filter-row">
        <Link className="active" href="/explore">
          All data
        </Link>
        {categories.map((category) => (
          <Link key={category.id} href={`/explore/${category.slug}`}>
            {category.name}
          </Link>
        ))}
      </div>
      <div className="results-header">
        <div>
          <h2>Top datacuts</h2>
          <span>{cuts.length} results</span>
        </div>
        <button type="button" className="sort-button">
          Most popular <Icon name="chevron" size={16} />
        </button>
      </div>
      <div className="category-layout">
        <aside>
          <b>Refine results</b>
          <label>Data format</label>
          {["CSV", "JSON", "Parquet", "Images"].map((filter) => (
            <button key={filter} type="button">
              <span className="checkbox" />
              {filter}
              <small>{20 + filter.length * 7}</small>
            </button>
          ))}
          <label>License</label>
          {["Commercial use", "Research", "Attribution"].map((filter) => (
            <button key={filter} type="button">
              <span className="checkbox" />
              {filter}
            </button>
          ))}
        </aside>
        <div className="datacut-grid page-grid">
          {cuts.map((cut) => (
            <DatacutCard key={cut.id} cut={cut} />
          ))}
        </div>
      </div>
    </section>
  );
}
