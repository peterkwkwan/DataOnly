import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DatacutCard } from "@/components/datacut-card";
import { Icon } from "@/components/icons";
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
  const top = (await catalog.getTopDatacuts()).filter((c) => c.categoryId === category.id);
  const popular = (await catalog.getPopularDatacuts()).filter((c) => c.categoryId === category.id);
  const all = await catalog.getDatacuts({ categoryId: category.id });
  const visible = all.length ? all : await catalog.getDatacuts();

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
      <div className="results-header">
        <div>
          <h2>Top {category.name}</h2>
          <span>{(top.length || visible.length)} results</span>
        </div>
        <button type="button" className="sort-button">
          Most popular <Icon name="chevron" size={16} />
        </button>
      </div>
      {(popular.length > 0 || top.length > 0) && (
        <p className="empty-hint" style={{ marginTop: 0, marginBottom: 18 }}>
          Rails: Top ({top.length || visible.length}) · Most popular ({popular.length || visible.length})
        </p>
      )}
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
          {visible.map((cut) => (
            <DatacutCard key={cut.id} cut={cut} />
          ))}
        </div>
      </div>
    </section>
  );
}
