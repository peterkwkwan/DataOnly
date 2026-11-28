import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Verified } from "@/components/brand";
import { DatacutCard } from "@/components/datacut-card";
import { FollowButton } from "@/components/follow-button";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { catalog as mockCatalog, getCatalog } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return mockCatalog.getCreators().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const creator = await catalog.getCreatorBySlug(slug);
  return { title: creator?.name ?? "Creator" };
}

export default async function CreatorStorefrontPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const creator = await catalog.getCreatorBySlug(slug);
  if (!creator) notFound();

  const cuts = await catalog.getDatacuts({ creatorId: creator.id });
  const rated = cuts.filter((c) => c.reviews > 0);
  const storefrontRating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum, c) => sum + c.rating, 0) / rated.length) * 100,
        ) / 100
      : null;

  return (
    <section className="page-view creators-view">
      <div className="page-intro creators-intro">
        <div>
          <span className="kicker">Creator storefront</span>
          <h1 className="dashboard-username">
            {creator.name}
            {creator.verified ? <Verified /> : null}
          </h1>
        </div>
        <div className="creator-stat">
          <strong>{creator.cuts}</strong>
          <span>
            listed datacuts
            <br />
            <span data-followers>{creator.followers}</span> followers
          </span>
        </div>
      </div>
      <article className="creator-store" style={{ maxWidth: 720, marginBottom: 40 }}>
        <div className="store-cover cover-1">
          <span>DATAONLY / {creator.specialty.toUpperCase()}</span>
          <div className="cover-shape" />
        </div>
        <div className="store-body">
          <div className="large-avatar" style={{ background: creator.color }}>
            {creator.initials}
          </div>
          <div className="store-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <FollowButton
              creatorId={creator.id}
              creatorSlug={creator.slug}
              creatorUserId={creator.userId}
              creatorName={creator.name}
              initialFollowers={creator.followers}
            />
            <ReportButton targetType="creator" creatorId={creator.id} />
          </div>
          <h2 className="creator-title">
            {creator.name}
            {creator.verified ? <Icon name="shield" size={16} /> : null}
          </h2>
          <p>{creator.specialty} · Steam-like shop for expert-curated datacuts.</p>
          {creator.bio.trim() ? <p>{creator.bio}</p> : null}
          <div className="store-stats">
            <span>
              <b>{creator.cuts}</b> Datacuts
            </span>
            <span>
              <b data-followers>{creator.followers}</b> Followers
            </span>
            <span>
              <b>{storefrontRating ?? "—"}</b> Rating
            </span>
          </div>
        </div>
      </article>
      <div className="results-header">
        <div>
          <h2>For sale</h2>
          <span>{cuts.length} datacuts</span>
        </div>
        <Link className="link-button" href="/creators">
          All creators
        </Link>
      </div>
      <div className="datacut-grid page-grid">
        {cuts.map((cut) => (
          <DatacutCard key={cut.id} cut={cut} />
        ))}
        {cuts.length === 0 && (
          <p className="empty-hint">No published datacuts yet in this mock catalog.</p>
        )}
      </div>
    </section>
  );
}
