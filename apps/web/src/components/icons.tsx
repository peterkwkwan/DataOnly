"use client";

import type { IndustryIconName } from "@dataonly/core";

export type IconName =
  | "arrow"
  | "bookmark"
  | "chevron"
  | "close"
  | "database"
  | "home"
  | "layers"
  | "menu"
  | "search"
  | "shield"
  | "spark"
  | "star"
  | "store"
  | "users";

export function Icon({
  name,
  size = 20,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <path d="m12 2 1.4 5.2L18 10l-4.6 2.8L12 18l-1.4-5.2L6 10l4.6-2.8L12 2ZM19 16l.6 2.4L22 19.5l-2.4 1.1L19 23l-.6-2.4-2.4-1.1 2.4-1.1L19 16Z" />
    ),
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    store: (
      <>
        <path d="M4 9h16l-1.4-5H5.4L4 9Z" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
        <path d="M4 9c0 1.7 2.7 2.7 4 1 1.3 1.7 3.7 1.7 5 0 1.3 1.7 4 1.7 5.3 0" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M16 4.5a3 3 0 0 1 0 5.8M17 13c2.3.5 3.5 2.4 3.7 5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function IndustryIcon({ name }: { name: IndustryIconName }) {
  const marks: Record<IndustryIconName, React.ReactNode> = {
    finance: (
      <>
        <path d="M12 5.5v21M21 10c0-2.5-3.1-4.5-7-4.5s-7 2-7 4.5 3.1 4.5 7 4.5 7 2 7 4.5-3.1 4.5-7 4.5-7-2-7-4.5" />
        <path d="M26 25 31 20l5 3 8-9" />
        <path d="M37 14h7v7" />
      </>
    ),
    healthcare: (
      <>
        <path d="M24 42S8 32.7 8 20.2C8 13.7 12.1 9 18 9c3.3 0 5.3 1.7 6 3 1-1.3 3-3 6-3 5.9 0 10 4.7 10 11.2C40 32.7 24 42 24 42Z" />
        <path d="M6 25h9l3-7 6 14 4-9 3 2h11" />
      </>
    ),
    engineering: (
      <>
        <path d="m15 8 18 32M33 8 15 40M10 24h28" />
        <circle cx="15" cy="8" r="3.5" />
        <circle cx="33" cy="8" r="3.5" />
        <circle cx="15" cy="40" r="3.5" />
        <circle cx="33" cy="40" r="3.5" />
        <circle cx="24" cy="24" r="4" />
      </>
    ),
    culinary: (
      <>
        <path d="M13 9v13M9 9v8a4 4 0 0 0 8 0V9M13 22v17" />
        <path d="M30 39V10c6 2 9 7 9 13h-9M30 23h9" />
        <path d="M25 39h10" />
      </>
    ),
    energy: (
      <>
        <path d="m27 5-15 23h12l-3 15 15-24H24l3-14Z" />
        <path d="M8 9h6M5 14h7M37 35h6M36 40h4" />
      </>
    ),
    fitness: (
      <>
        <circle cx="25" cy="8" r="4" />
        <path d="m22 16-6 7 8 5 5 11M23 17l8 5 7-4M16 23l-7 8M24 28l-9 10" />
        <path d="M35 12h8M39 8v8" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {marks[name]}
    </svg>
  );
}
