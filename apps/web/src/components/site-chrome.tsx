"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icons";
import { NotificationsBell } from "@/components/notifications-bell";
import { useAuth } from "@/context/auth-context";
import { MobileShell } from "@/components/mobile-shell";

function SavedNavActive({ onActive }: { onActive: (active: boolean) => void }) {
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") === "saved";
  useEffect(() => {
    onActive(active);
  }, [active, onActive]);
  return null;
}

const NAV = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/explore", label: "Categories", match: (p: string) => p.startsWith("/explore") },
  { href: "/creators", label: "Creators", match: (p: string) => p.startsWith("/creators") },
];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut, isAdmin, configured } = useAuth();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [savedNavActive, setSavedNavActive] = useState(false);
  const accountEmail = profile?.email || user?.email || "";
  const accountName =
    profile?.displayName?.trim() || accountEmail.split("@")[0] || "Account";

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
            <Link className="primary-button small" href={configured ? "/dashboard" : "/auth/sign-in"}>
              Start selling <Icon name="arrow" size={16} />
            </Link>
            {user ? <NotificationsBell /> : null}
            {user ? (
              <Link
                className={
                  pathname.startsWith("/dashboard") ? "text-button active" : "text-button"
                }
                href="/dashboard"
              >
                Dashboard
              </Link>
            ) : (
              <Link className="text-button" href="/auth/sign-in">
                Sign in
              </Link>
            )}
            {user ? <AccountMenu /> : null}
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
            <Link href="/dashboard?tab=saved" onClick={() => setMobileMenu(false)}>
              Saved
            </Link>
            <Link href="/search" onClick={() => setMobileMenu(false)}>
              Search
            </Link>
            <Link href="/dashboard" onClick={() => setMobileMenu(false)}>
              Dashboard
            </Link>
            {user ? (
              <div className="mobile-account">
                <div className="mobile-account-header">
                  <div className="mobile-account-identity">
                    <b>{accountName}</b>
                    {accountEmail ? <span>{accountEmail}</span> : null}
                  </div>
                </div>
                <Link href="/account" onClick={() => setMobileMenu(false)}>
                  Account
                </Link>
                {isAdmin ? (
                  <>
                    <Link href="/admin/verification" onClick={() => setMobileMenu(false)}>
                      Verification
                    </Link>
                    <Link href="/admin/refunds" onClick={() => setMobileMenu(false)}>
                      Refunds
                    </Link>
                    <Link href="/admin/reports" onClick={() => setMobileMenu(false)}>
                      Reports
                    </Link>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenu(false);
                    void signOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/auth/sign-in" onClick={() => setMobileMenu(false)}>
                Sign in
              </Link>
            )}
            <Link className="primary-button" href="/dashboard" onClick={() => setMobileMenu(false)}>
              Start selling
            </Link>
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
          <Link
            href="/dashboard?tab=saved"
            className={savedNavActive ? "active" : undefined}
          >
            <Suspense fallback={null}>
              <SavedNavActive onActive={setSavedNavActive} />
            </Suspense>
            <Icon name="bookmark" />
            <span>Saved</span>
          </Link>
        </nav>
      </div>
      <MobileShell />
    </div>
  );
}
