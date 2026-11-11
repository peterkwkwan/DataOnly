import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DatacutDetailClient } from "@/components/datacut-detail-client";
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

  return (
    <>
      <DatacutDetailClient cut={cut} creatorSlug={creator?.slug} creatorVerified={!!creator?.verified} />
      <p className="empty-hint" style={{ padding: "0 5vw 60px" }}>
        <Link href={category ? `/explore/${category.slug}` : "/explore"}>
          ← Back to {cut.categoryName}
        </Link>
      </p>
    </>
  );
}
