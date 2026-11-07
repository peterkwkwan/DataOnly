"use client";

import type { Datacut } from "@dataonly/core";
import Link from "next/link";
import { Art } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSaved } from "@/context/saved-context";
import { catalog } from "@/lib/catalog";

export function DatacutCard({ cut }: { cut: Datacut }) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(cut.id);
  const creator = catalog.getCreators().find((c) => c.id === cut.creatorId);

  return (
    <article className="datacut-card">
      <Link href={`/datacuts/${cut.slug}`} className="art-wrap" style={{ backgroundColor: cut.accent }}>
        <Art type={cut.art} />
        <span className="category-pill">{cut.categoryName}</span>
      </Link>
      <button
        type="button"
        className={`save-button ${saved ? "saved" : ""}`}
        onClick={() => toggleSaved(cut.id)}
        aria-label={saved ? "Remove from saved" : "Save datacut"}
      >
        <Icon name="bookmark" size={18} filled={saved} />
      </button>
      <div className="cut-body">
        <Link href={creator ? `/creators/${creator.slug}` : "/creators"} className="creator-name">
          {cut.creatorName} {creator?.verified ? <Icon name="shield" size={13} /> : null}
        </Link>
        <h3>
          <Link href={`/datacuts/${cut.slug}`}>{cut.title}</Link>
        </h3>
        <div className="cut-meta">
          <span>{cut.records} records</span>
          <i /> <span>{cut.size}</span>
          <i /> <span>{cut.format}</span>
        </div>
        <div className="cut-footer">
          <span className="rating">
            <Icon name="star" size={14} filled /> {cut.rating}{" "}
            <small>({cut.reviews})</small>
          </span>
          <span className="price">
            ${cut.price}
            <small> USD</small>
          </span>
        </div>
      </div>
    </article>
  );
}

export function DatacutSection({
  title,
  subtitle,
  cuts,
  browseHref = "/explore",
}: {
  title: string;
  subtitle: string;
  cuts: Datacut[];
  browseHref?: string;
}) {
  return (
    <section className="section popular-section">
      <div className="section-heading">
        <div>
          <span className="kicker">{subtitle}</span>
          <h2>{title}</h2>
        </div>
        <Link className="link-button" href={browseHref}>
          Browse all datacuts <Icon name="arrow" size={17} />
        </Link>
      </div>
      <div className="datacut-grid">
        {cuts.map((cut) => (
          <DatacutCard key={cut.id} cut={cut} />
        ))}
      </div>
    </section>
  );
}
