"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingForm } from "@/components/listing-form";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Category, Creator } from "@dataonly/core";
import { mapCategory, type CategoryRow } from "@dataonly/core";

export default function NewListingPage() {
  const { user, profile, loading } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured()) return;
    let cancelled = false;
    async function load() {
      try {
        const supabase = createBrowserSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        const { data, error: catError } = await supabase.from("categories").select("*").order("name");
        if (catError) throw catError;
        if (!cancelled) {
          setCreator(ensured);
          setCategories(((data ?? []) as CategoryRow[]).map(mapCategory));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, profile?.displayName, user]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase to create listings.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <Link href="/auth/sign-in?next=/dashboard/listings/new">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Listings</span>
        <h1>New datacut</h1>
        <p>Save as draft or publish to the public catalog.</p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {creator && categories.length > 0 ? (
        <ListingForm creatorId={creator.id} categories={categories} />
      ) : (
        <p className="empty-hint">Preparing form…</p>
      )}
    </section>
  );
}
