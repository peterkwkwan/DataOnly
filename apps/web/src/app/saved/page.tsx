"use client";

import Link from "next/link";
import { DatacutCard } from "@/components/datacut-card";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";
import { useSaved } from "@/context/saved-context";
import { catalog } from "@/lib/catalog";

export default function SavedPage() {
  const { savedIds, syncError } = useSaved();
  const { user, configured } = useAuth();
  // Client catalog is mock (ids 1–4); those match supabase/seed.sql. Live-only
  // listing ids still count in savedIds but may not resolve to a card here.
  const cuts = catalog.getDatacuts().filter((cut) => savedIds.includes(cut.id));
  const statusLabel =
    configured && user ? "Synced to your account" : "Saved on this device";

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Your library</span>
        <h1>Saved datacuts.</h1>
        <p>Keep the datacuts you care about in one place — ready when you are.</p>
      </div>
      {syncError ? (
        <p className="form-error" role="status" style={{ marginBottom: 16 }}>
          {syncError}
        </p>
      ) : null}
      <div className="results-header">
        <div>
          <h2>{savedIds.length} saved</h2>
          <span>{statusLabel}</span>
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
