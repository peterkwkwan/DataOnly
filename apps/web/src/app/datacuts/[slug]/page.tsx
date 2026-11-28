import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DatacutCard } from "@/components/datacut-card";
import { DatacutDetailClient } from "@/components/datacut-detail-client";
import { Icon } from "@/components/icons";
import { catalog as mockCatalog, getCatalog } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return mockCatalog.getDatacuts().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const cut = await catalog.getDatacutBySlug(slug);
  return {
    title: cut?.title ?? "Datacut",
    description: cut?.description,
  };
}

export default async function DatacutDetailPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const cut = await catalog.getDatacutBySlug(slug);
  if (!cut) notFound();
  const creators = await catalog.getCreators();
  const categories = await catalog.getCategories();
  const creator = creators.find((c) => c.id === cut.creatorId);
  const category = categories.find((c) => c.id === cut.categoryId);
  const related = (await catalog.getDatacuts({ categoryId: cut.categoryId }))
    .filter((c) => c.id !== cut.id)
    .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
    .slice(0, 6);

  return (
    <>
      <Suspense fallback={<p className="empty-hint">Loading datacut…</p>}>
        <DatacutDetailClient
          cut={cut}
          creatorSlug={creator?.slug}
          creatorVerified={!!creator?.verified}
          creatorUserId={creator?.userId}
          categorySlug={category?.slug}
        />
      </Suspense>
      {related.length > 0 ? (
        <section className="section related-section" aria-labelledby="related-heading">
          <div className="section-heading">
            <div>
              <span className="kicker">Related</span>
              <h2 id="related-heading">More in {cut.categoryName}</h2>
            </div>
            {category ? (
              <Link className="link-button" href={`/explore/${category.slug}`}>
                Browse {cut.categoryName} <Icon name="arrow" size={17} />
              </Link>
            ) : null}
          </div>
          <div className="related-rail">
            {related.map((sibling) => (
              <DatacutCard key={sibling.id} cut={sibling} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
