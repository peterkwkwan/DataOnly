"use client";

import Link from "next/link";
import { DatacutCard } from "@/components/datacut-card";
import { Icon } from "@/components/icons";
import { useSaved } from "@/context/saved-context";
import { catalog } from "@/lib/catalog";

export default function SavedPage() {
  const { savedIds } = useSaved();
  const cuts = catalog.getDatacuts().filter((cut) => savedIds.includes(cut.id));

  return (
    <section className="saved-page page-view">
      <div className="page-intro">
        <span className="kicker">Your library</span>
        <h1>Saved datacuts.</h1>
        <p>Prototype wishlist — stored in this browser only.</p>
      </div>
      <div className="results-header">
        <div>
          <h2>{savedIds.length} saved</h2>
          <span>Local mock state</span>
        </div>
        <Link className="link-button" href="/explore">
          Explore marketplace <Icon name="arrow" size={17} />
        </Link>
      </div>
      {cuts.length ? (
        <div className="datacut-grid page-grid">
          {cuts.map((cut) => (
            <DatacutCard key={cut.id} cut={cut} />
          ))}
        </div>
      ) : (
        <div className="m-empty-state" style={{ marginTop: 40 }}>
          <Icon name="bookmark" size={28} />
          <h3>Your library is empty</h3>
          <p>Save datacuts to compare or purchase later.</p>
          <Link href="/explore" className="primary-button" style={{ display: "inline-flex" }}>
            Explore marketplace
          </Link>
        </div>
      )}
    </section>
  );
}
