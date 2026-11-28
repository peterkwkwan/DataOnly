import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExploreResults } from "@/components/explore-results";
import { catalog as mockCatalog, getCatalog } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return mockCatalog.getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const category = await catalog.getCategoryBySlug(slug);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const category = await catalog.getCategoryBySlug(slug);
  if (!category) notFound();

  const categories = await catalog.getCategories();
  const all = await catalog.getDatacuts({ categoryId: category.id });
  const cuts = all.length ? all : await catalog.getDatacuts();

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">{category.name}</span>
        <h1>{category.name} data.</h1>
        <p>{category.blurb}</p>
      </div>
      <div className="filter-row">
        <Link href="/explore">All data</Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/explore/${item.slug}`}
            className={item.id === category.id ? "active" : undefined}
          >
            {item.name}
          </Link>
        ))}
      </div>
      <ExploreResults cuts={cuts} heading={category.name} />
    </section>
  );
}
