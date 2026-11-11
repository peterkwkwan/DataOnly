"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { Category, Datacut, LicenseTemplate, ListingStatus } from "@dataonly/core";
import { licenseBlurb } from "@dataonly/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  creatorId: string;
  categories: Category[];
  initial?: Datacut | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

export function ListingForm({ creatorId, categories, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? 49));
  const [size, setSize] = useState(initial?.size ?? "1 GB");
  const [records, setRecords] = useState(initial?.records ?? "10K");
  const [format, setFormat] = useState(initial?.format ?? "CSV");
  const [license, setLicense] = useState<LicenseTemplate>(initial?.license ?? "personal");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ListingStatus>(initial?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blurb = useMemo(() => licenseBlurb(license), [license]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const payload = {
        title: title.trim(),
        slug: (slug || slugify(title)).trim(),
        creator_id: creatorId,
        category_id: categoryId,
        price: Number(price) || 0,
        size: size.trim(),
        records: records.trim(),
        format: format.trim(),
        license,
        description: description.trim(),
        status,
        accent: initial?.accent ?? "#c6ff4a",
        art: initial?.art ?? "data",
        updated_label: `Updated ${new Date().toLocaleDateString()}`,
        updated_at: new Date().toISOString(),
      };

      if (initial) {
        const { error: updateError } = await supabase
          .from("datacuts")
          .update(payload)
          .eq("id", initial.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("datacuts").insert(payload);
        if (insertError) throw insertError;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card listing-form" onSubmit={onSubmit}>
      <label>
        Title
        <input
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!initial) setSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label>
        Slug
        <input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
      </label>
      <label>
        Category
        <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Price (USD)
          <input type="number" min={0} step="1" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          Format
          <input required value={format} onChange={(e) => setFormat(e.target.value)} />
        </label>
        <label>
          Size
          <input required value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label>
          Records
          <input required value={records} onChange={(e) => setRecords(e.target.value)} />
        </label>
      </div>
      <label>
        License template
        <select
          value={license}
          onChange={(e) => setLicense(e.target.value as LicenseTemplate)}
        >
          <option value="personal">Personal Use</option>
          <option value="commercial">Commercial Use</option>
        </select>
      </label>
      <p className="form-footnote">{blurb}</p>
      <label>
        Description
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Saving…" : "Save listing"}
        </button>
        <Link className="text-button" href="/dashboard">
          Cancel
        </Link>
      </div>
    </form>
  );
}
