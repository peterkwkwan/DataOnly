"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ListingStatus } from "@dataonly/core";
import { Icon } from "@/components/icons";

type ListingRowMenuProps = {
  editHref: string;
  statsHref: string;
  listingTitle: string;
  status: ListingStatus;
  busy?: boolean;
  onTogglePublish: () => void;
};

export function ListingRowMenu({
  editHref,
  statsHref,
  listingTitle,
  status,
  busy = false,
  onTogglePublish,
}: ListingRowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isPublished = status === "published";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="listing-row-menu" ref={rootRef}>
      <button
        type="button"
        className="listing-row-menu-trigger"
        aria-label={`Actions for ${listingTitle}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" size={18} />
      </button>

      {open ? (
        <div
          className="listing-row-menu-panel"
          id={menuId}
          role="menu"
          aria-label={`Actions for ${listingTitle}`}
        >
          <div className="listing-row-menu-items">
            <Link
              role="menuitem"
              className="listing-row-menu-item"
              href={editHref}
              onClick={() => setOpen(false)}
            >
              <Icon name="edit" size={16} />
              Edit
            </Link>
            <button
              type="button"
              role="menuitem"
              className={
                isPublished
                  ? "listing-row-menu-item listing-row-menu-item--danger"
                  : "listing-row-menu-item"
              }
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onTogglePublish();
              }}
            >
              <Icon name={isPublished ? "trash" : "spark"} size={16} />
              {busy
                ? isPublished
                  ? "Unpublishing…"
                  : "Publishing…"
                : isPublished
                  ? "Unpublish"
                  : "Publish"}
            </button>
            <Link
              role="menuitem"
              className="listing-row-menu-item"
              href={statsHref}
              onClick={() => setOpen(false)}
            >
              <Icon name="chart" size={16} />
              View stats
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
