"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ListingForm } from "@/components/listing-form";
import { useAuth } from "@/context/auth-context";
import { ensureCreatorForUser } from "@/lib/creator";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Category, Creator, Datacut } from "@dataonly/core";
import {
  mapCategory,
  mapDatacut,
  type CategoryRow,
  type DatacutRow,
} from "@dataonly/core";

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const { user, profile, loading } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cut, setCut] = useState<Datacut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured()) return;
    let cancelled = false;
    async function load() {
      try {
        const supabase = createBrowserSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        const [{ data: cats, error: catError }, { data: row, error: cutError }] = await Promise.all([
          supabase.from("categories").select("*").order("name"),
          supabase
            .from("datacuts")
            .select(
              "id, slug, title, creator_id, category_id, price, rating, reviews, size, records, accent, art, updated_label, format, license, description, status, creators(name), categories(name)",
            )
            .eq("id", Number(params.id))
            .maybeSingle(),
        ]);
        if (catError) throw catError;
        if (cutError) throw cutError;
        if (!cancelled) {
          setCreator(ensured);
          setCategories(((cats ?? []) as CategoryRow[]).map(mapCategory));
          setCut(row ? mapDatacut(row as DatacutRow) : null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load listing");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, params.id, profile?.displayName, user]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="page-view">
        <p className="empty-hint">Configure Supabase to edit listings.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-view">
        <Link href={`/auth/sign-in?next=/dashboard/listings/${params.id}`}>Sign in</Link>
      </section>
    );
  }

  return (
    <section className="page-view">
      <div className="page-intro">
        <span className="kicker">Listings</span>
        <h1>Edit datacut</h1>
        <p>Update draft metadata or publish to the catalog.</p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {!cut && !error ? <p className="empty-hint">Loading…</p> : null}
      {cut && creator ? (
        <ListingForm creatorId={creator.id} categories={categories} initial={cut} />
      ) : null}
      {error || (cut === null && !loading) ? (
        <p className="empty-hint">
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      ) : null}
    </section>
  );
}
