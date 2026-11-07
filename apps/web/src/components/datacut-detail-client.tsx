"use client";

import type { Datacut } from "@dataonly/core";
import Link from "next/link";
import { useState } from "react";
import { Art, Verified } from "@/components/brand";
import { BuyModal } from "@/components/buy-modal";
import { Icon } from "@/components/icons";
import { useSaved } from "@/context/saved-context";

export function DatacutDetailClient({
  cut,
  creatorSlug,
  creatorVerified,
}: {
  cut: Datacut;
  creatorSlug?: string;
  creatorVerified: boolean;
}) {
  const { isSaved, toggleSaved } = useSaved();
  const [buyOpen, setBuyOpen] = useState(false);
  const saved = isSaved(cut.id);

  return (
    <div className="detail-layout">
      <div className="detail-art" style={{ background: cut.accent }}>
        <Art type={cut.art} />
      </div>
      <div className="detail-panel">
        <span className="kicker">{cut.categoryName}</span>
        <h1>{cut.title}</h1>
        <div className="detail-meta">
          <Link href={creatorSlug ? `/creators/${creatorSlug}` : "/creators"}>
            {cut.creatorName}
          </Link>
          {creatorVerified ? <Verified /> : null}
          <span>
            <Icon name="star" size={14} filled /> {cut.rating} ({cut.reviews})
          </span>
          <span>{cut.updated}</span>
        </div>
        <p>{cut.description}</p>
        <div className="detail-meta">
          <span>{cut.records} records</span>
          <span>{cut.size}</span>
          <span>{cut.format}</span>
        </div>
        <div className="buy-license">{cut.licenseBlurb}</div>
        <div className="detail-price">${cut.price} USD</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary-button" onClick={() => setBuyOpen(true)}>
            Buy datacut <Icon name="arrow" size={16} />
          </button>
          <button
            type="button"
            className={`icon-button ${saved ? "saved" : ""}`}
            onClick={() => toggleSaved(cut.id)}
            aria-label="Save"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              width: "auto",
              padding: "0 14px",
              gap: 8,
              display: "inline-flex",
            }}
          >
            <Icon name="bookmark" size={18} filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <BuyModal cut={cut} open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}
