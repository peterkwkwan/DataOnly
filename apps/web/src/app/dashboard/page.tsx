"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Verified } from "@/components/brand";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, Datacut } from "@dataonly/core";
import { mapDatacut, type DatacutRow } from "@dataonly/core";

export default function DashboardPage() {
  const { user, profile, loading, configured, isAdmin } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [listings, setListings] = useState<Datacut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!configured || !user) return;

    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        if (cancelled) return;
        setCreator(ensured);
        const { data, error: listError } = await supabase
          .from("datacuts")
          .select(
            "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, creators(name), categories(name)",
          )
          .eq("creator_id", ensured.id)
          .order("updated_at", { ascending: false });
        if (listError) throw listError;
        if (!cancelled) setListings(((data ?? []) as DatacutRow[]).map(mapDatacut));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, profile?.displayName, user]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <span className="kicker">Creator dashboard</span>
          <h1>Connect Supabase to manage listings</h1>
          <p>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
            run migrations + seed, then sign in. The public catalog still works with mock data.
          </p>
          <Link className="primary-button" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (loading || busy) {
    return (
      <section className="page-view">
        <p className="empty-hint">Loading dashboard…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <div className="page-intro">
          <h1>Sign in required</h1>
          <p>Creator tools need an account.</p>
          <Link className="primary-button" href="/auth/sign-in?next=/dashboard">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-view dashboard-view">
      <div className="page-intro creators-intro">
        <div>
          <span className="kicker">Creator dashboard</span>
          <h1>{creator?.name ?? "Your store"}</h1>
          <p>
            Draft and publish datacuts, apply for verification, and manage your storefront.
            {creator?.verified ? " You are Verified." : " Unverified creators can still list and sell."}
          </p>
          {creator?.verified ? <Verified /> : null}
        </div>
        <div className="dashboard-actions">
          <Link className="primary-button" href="/dashboard/listings/new">
            New listing
          </Link>
          <Link className="text-button" href="/dashboard/verification">
            Verification
          </Link>
          {isAdmin ? (
            <Link className="text-button" href="/admin/verification">
              Admin queue
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="results-header">
        <div>
          <h2>Your listings</h2>
          <span>{listings.length}</span>
        </div>
        {creator ? (
          <Link className="link-button" href={`/creators/${creator.slug}`}>
            View storefront
          </Link>
        ) : null}
      </div>

      <div className="listing-table">
        {listings.length === 0 ? (
          <p className="empty-hint">No listings yet. Create a draft to get started.</p>
        ) : (
          listings.map((cut) => (
            <article key={cut.id} className="listing-row">
              <div>
                <b>{cut.title}</b>
                <span>
                  {cut.status ?? "draft"} · {cut.license} · ${cut.price}
                </span>
              </div>
              <Link href={`/dashboard/listings/${cut.id}`}>Edit</Link>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
