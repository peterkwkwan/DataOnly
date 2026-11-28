import type { Metadata } from "next";
import Link from "next/link";
import { ExploreResults } from "@/components/explore-results";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Explore",
};

export default async function ExplorePage() {
  const catalog = await getCatalog();
  const categories = await catalog.getCategories();
  const cuts = await catalog.getDatacuts();

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
      <ExploreResults cuts={cuts} heading="Datacuts" />
    </section>
  );
}
