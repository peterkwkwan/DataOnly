"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSaved } from "@/context/saved-context";
import { MobileShell } from "@/components/mobile-shell";

const NAV = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/explore", label: "Categories", match: (p: string) => p.startsWith("/explore") },
  { href: "/creators", label: "Creators", match: (p: string) => p.startsWith("/creators") },
];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { savedIds } = useSaved();
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="app-shell">
      <div className="web-portal">
        <header className="topbar">
          <Link className="brand-button" href="/" onClick={() => setMobileMenu(false)}>
            <Logo />
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.match(pathname) ? "active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="icon-button" href="/saved" aria-label="Saved">
              <Icon name="bookmark" size={19} />
              <span className="save-count">{savedIds.length}</span>
            </Link>
            <button type="button" className="text-button">
              Sign in
            </button>
            <button type="button" className="primary-button small">
              Start selling <Icon name="arrow" size={16} />
            </button>
            <button
              type="button"
              className="menu-button"
              onClick={() => setMobileMenu(!mobileMenu)}
              aria-label="Toggle menu"
            >
              <Icon name={mobileMenu ? "close" : "menu"} />
            </button>
          </div>
        </header>

        {mobileMenu && (
          <div className="mobile-menu">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/saved" onClick={() => setMobileMenu(false)}>
              Saved
            </Link>
            <Link href="/search" onClick={() => setMobileMenu(false)}>
              Search
            </Link>
            <button type="button">Sign in</button>
            <button type="button" className="primary-button">
              Start selling
            </button>
          </div>
        )}

        <main>{children}</main>

        <footer>
          <Logo />
          <p>Expert knowledge, made useful.</p>
          <div>
            <Link href="/explore">Marketplace</Link>
            <Link href="/creators">For creators</Link>
            <button type="button">About</button>
            <button type="button">Terms</button>
          </div>
          <span>© 2026 DataOnly</span>
        </footer>

        <nav className="bottom-nav" aria-label="Mobile navigation">
          <Link href="/" className={pathname === "/" ? "active" : undefined}>
            <Icon name="home" />
            <span>Discover</span>
          </Link>
          <Link
            href="/explore"
            className={pathname.startsWith("/explore") ? "active" : undefined}
          >
            <Icon name="layers" />
            <span>Categories</span>
          </Link>
          <Link href="/search" className="mobile-search" aria-label="Search">
            <Icon name="search" />
          </Link>
          <Link
            href="/creators"
            className={pathname.startsWith("/creators") ? "active" : undefined}
          >
            <Icon name="users" />
            <span>Creators</span>
          </Link>
          <Link href="/saved" className={pathname.startsWith("/saved") ? "active" : undefined}>
            <Icon name="bookmark" />
            <span>Saved</span>
          </Link>
        </nav>
      </div>
      <MobileShell />
    </div>
  );
}
