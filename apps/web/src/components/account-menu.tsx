"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";

function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountMenu() {
  const pathname = usePathname();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const email = profile?.email || user?.email || "";
  const displayName =
    profile?.displayName?.trim() || email.split("@")[0] || "Account";
  const initials = initialsFrom(profile?.displayName, email);

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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!user) return null;

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="account-menu-label">{displayName}</span>
        <Icon name="chevron" size={14} />
      </button>

      {open ? (
        <div
          className="account-menu-panel"
          id={menuId}
          role="menu"
          aria-label="Account"
        >
          <div className="account-menu-header">
            <div className="account-menu-identity">
              <b>{displayName}</b>
              {email ? <span>{email}</span> : null}
            </div>
            <span className="account-avatar" aria-hidden="true">
              {initials}
            </span>
          </div>

          <div className="account-menu-items">
            <Link
              role="menuitem"
              className={
                pathname.startsWith("/account") ? "account-menu-item active" : "account-menu-item"
              }
              href="/account"
              onClick={() => setOpen(false)}
            >
              <Icon name="users" size={16} />
              Account
            </Link>
            {isAdmin ? (
              <>
                <Link
                  role="menuitem"
                  className={
                    pathname.startsWith("/admin/verification")
                      ? "account-menu-item active"
                      : "account-menu-item"
                  }
                  href="/admin/verification"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="shield" size={16} />
                  Verification
                </Link>
                <Link
                  role="menuitem"
                  className={
                    pathname.startsWith("/admin/refunds")
                      ? "account-menu-item active"
                      : "account-menu-item"
                  }
                  href="/admin/refunds"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="arrow" size={16} />
                  Refunds
                </Link>
                <Link
                  role="menuitem"
                  className={
                    pathname.startsWith("/admin/reports")
                      ? "account-menu-item active"
                      : "account-menu-item"
                  }
                  href="/admin/reports"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="shield" size={16} />
                  Reports
                </Link>
              </>
            ) : null}
          </div>

          <div className="account-menu-divider" role="separator" />

          <div className="account-menu-items">
            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
