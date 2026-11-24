"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category, Datacut, LicenseTemplate, ListingStatus } from "@dataonly/core";
import { licenseBlurb } from "@dataonly/core";
import { Icon } from "@/components/icons";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Approved formats; labels match existing `datacuts.format` text values. */
export const FORMAT_OPTIONS = [
  "CSV",
  "Parquet",
  "JSON",
  "JSONL",
  "XLSX",
  "TSV",
  "PDF",
  "DOCX",
  "ZIP",
] as const;

export type FormatOption = (typeof FORMAT_OPTIONS)[number];

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

function normalizeFormat(value: string | undefined | null): FormatOption {
  if (!value) return "CSV";
  const match = FORMAT_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  return match ?? "CSV";
}

export function ListingForm({ creatorId, categories, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? 49));
  const [size, setSize] = useState(initial?.size ?? "1 GB");
  const [records, setRecords] = useState(initial?.records ?? "10K");
  const [format, setFormat] = useState<FormatOption>(() => normalizeFormat(initial?.format));
  const [license, setLicense] = useState<LicenseTemplate>(initial?.license ?? "personal");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ListingStatus>(initial?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(() =>
    Math.max(0, FORMAT_OPTIONS.indexOf(normalizeFormat(initial?.format))),
  );
  const formatFieldId = useId();
  const formatListboxId = `${formatFieldId}-listbox`;
  const formatRef = useRef<HTMLDivElement>(null);

  const blurb = useMemo(() => licenseBlurb(license), [license]);

  useEffect(() => {
    if (!formatOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!formatRef.current?.contains(event.target as Node)) {
        setFormatOpen(false);
      }
    }
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setFormatOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [formatOpen]);

  function onFormatKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!formatOpen) {
        setFormatOpen(true);
        setActiveOption(Math.max(0, FORMAT_OPTIONS.indexOf(format)));
        return;
      }
      setActiveOption((current) => {
        const delta = event.key === "ArrowDown" ? 1 : -1;
        return (current + delta + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
      });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!formatOpen) {
        setFormatOpen(true);
        setActiveOption(Math.max(0, FORMAT_OPTIONS.indexOf(format)));
        return;
      }
      const option = FORMAT_OPTIONS[activeOption];
      if (option) {
        setFormat(option);
        setFormatOpen(false);
      }
      return;
    }
    if (event.key === "Escape" && formatOpen) {
      event.preventDefault();
      setFormatOpen(false);
    }
  }

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
        format,
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
      setError(formatClientError(err, "Save failed"));
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
        <div className="industry-field" ref={formatRef}>
          <span className="industry-field-label" id={formatFieldId}>
            Format
          </span>
          <button
            type="button"
            className={`industry-select-trigger${formatOpen ? " is-open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={formatOpen}
            aria-controls={formatListboxId}
            aria-labelledby={formatFieldId}
            onClick={() => {
              setFormatOpen((open) => {
                if (!open) setActiveOption(Math.max(0, FORMAT_OPTIONS.indexOf(format)));
                return !open;
              });
            }}
            onKeyDown={onFormatKeyDown}
          >
            <span>{format}</span>
            <Icon name="chevron" size={18} />
          </button>
          {formatOpen ? (
            <ul
              id={formatListboxId}
              className="industry-select-menu"
              role="listbox"
              aria-labelledby={formatFieldId}
            >
              {FORMAT_OPTIONS.map((option, index) => {
                const selected = option === format;
                const active = index === activeOption;
                return (
                  <li key={option} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`industry-select-option${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveOption(index)}
                      onClick={() => {
                        setFormat(option);
                        setFormatOpen(false);
                      }}
                    >
                      <span>{option}</span>
                      {selected ? (
                        <span className="industry-select-check" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
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
