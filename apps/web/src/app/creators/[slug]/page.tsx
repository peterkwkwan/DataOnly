import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Verified } from "@/components/brand";
import { DatacutCard } from "@/components/datacut-card";
import { catalog } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return catalog.getCreators().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const creator = catalog.getCreatorBySlug(slug);
  return { title: creator?.name ?? "Creator" };
}

export default async function CreatorStorefrontPage({ params }: Props) {
  const { slug } = await params;
  const creator = catalog.getCreatorBySlug(slug);
  if (!creator) notFound();

  const cuts = catalog.getDatacuts({ creatorId: creator.id });

  return (
    <section className="page-view creators-view">
      <div className="page-intro creators-intro">
        <div>
          <span className="kicker">Creator storefront</span>
          <h1>{creator.name}</h1>
          <p>{creator.bio}</p>
          {creator.verified ? <Verified /> : null}
        </div>
        <div className="creator-stat">
          <strong>{creator.cuts}</strong>
          <span>
            listed datacuts
            <br />
            {creator.followers} followers
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
          <button type="button" className="follow-button">
            Follow
          </button>
          <h2>{creator.name}</h2>
          {creator.verified ? <Verified /> : null}
          <p>{creator.specialty} · Steam-like shop for expert-curated datacuts.</p>
          <div className="store-stats">
            <span>
              <b>{creator.cuts}</b> Datacuts
            </span>
            <span>
              <b>{creator.followers}</b> Followers
            </span>
            <span>
              <b>4.9</b> Rating
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
