"use client";

import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasAcceptedCreatorTos } from "@dataonly/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Forces Creator ToS acceptance before any dashboard creator actions
 * (listings, verification). `/dashboard/tos` is exempt so they can accept.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isTosRoute = pathname === "/dashboard/tos" || pathname.startsWith("/dashboard/tos/");

  useEffect(() => {
    if (!isSupabaseConfigured() || !configured) return;
    if (loading) return;
    if (!user) return;
    if (isTosRoute) return;
    if (hasAcceptedCreatorTos(profile)) return;
    const next = encodeURIComponent(`${pathname || "/dashboard"}${window.location.search}`);
    router.replace(`/dashboard/tos?next=${next}`);
  }, [configured, isTosRoute, loading, pathname, profile, router, user]);

  if (
    isSupabaseConfigured() &&
    configured &&
    !loading &&
    user &&
    !isTosRoute &&
    !hasAcceptedCreatorTos(profile)
  ) {
    return (
      <section className="page-view">
        <p className="empty-hint">Redirecting to Creator Terms…</p>
      </section>
    );
  }

  return children;
}
