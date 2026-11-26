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
import { MenuSelect } from "@/components/menu-select";
import { formatClientError } from "@/lib/errors";
import { buildDatacutObjectPath, DATACUT_STORAGE_BUCKET, sanitizeFileName } from "@/lib/storage";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LICENSE_OPTIONS: { value: LicenseTemplate; label: string }[] = [
  { value: "personal", label: "Personal Use" },
  { value: "commercial", label: "Commercial Use" },
];

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished (moderation)" },
];

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
  const [file, setFile] = useState<File | null>(null);
  const [attachedName, setAttachedName] = useState(initial?.fileName ?? null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(() =>
    Math.max(0, FORMAT_OPTIONS.indexOf(normalizeFormat(initial?.format))),
  );
  const formatFieldId = useId();
  const formatListboxId = `${formatFieldId}-listbox`;
  const formatRef = useRef<HTMLDivElement>(null);

  const blurb = useMemo(() => licenseBlurb(license), [license]);

  const canSave = useMemo(() => {
    const priceNum = Number(price);
    return (
      title.trim().length > 0 &&
      (slug.trim() || slugify(title)).length > 0 &&
      categoryId.trim().length > 0 &&
      price.trim().length > 0 &&
      Number.isFinite(priceNum) &&
      priceNum >= 0 &&
      Boolean(format) &&
      Boolean(license) &&
      description.trim().length > 0 &&
      Boolean(status)
    );
  }, [title, slug, categoryId, price, format, license, description, status]);

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
    if (!canSave || busy) return;
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

      let datacutId = initial?.id;
      if (initial) {
        const { error: updateError } = await supabase
          .from("datacuts")
          .update(payload)
          .eq("id", initial.id);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("datacuts")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        datacutId = Number(inserted.id);
      }

      if (file && datacutId) {
        const objectPath = buildDatacutObjectPath(creatorId, datacutId, file.name);
        const { error: uploadError } = await supabase.storage
          .from(DATACUT_STORAGE_BUCKET)
          .upload(objectPath, file, { upsert: true, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const fileName = sanitizeFileName(file.name);
        const { error: pathError } = await supabase
          .from("datacuts")
          .update({
            storage_path: objectPath,
            file_name: fileName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", datacutId);
        if (pathError) throw pathError;
        setAttachedName(fileName);
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
        Title *
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
        Slug *
        <input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
      </label>
      <label>
        Category *
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
          Price (USD) *
          <input type="number" min={0} step="1" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <div className="industry-field" ref={formatRef}>
          <span className="industry-field-label" id={formatFieldId}>
            Format *
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
          <input value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label>
          Records
          <input value={records} onChange={(e) => setRecords(e.target.value)} />
        </label>
      </div>
      <MenuSelect
        label="License template *"
        value={license}
        options={LICENSE_OPTIONS}
        onChange={setLicense}
      />
      <p className="form-footnote">{blurb}</p>
      <label>
        Description *
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <MenuSelect
        label="Status *"
        value={status}
        options={STATUS_OPTIONS}
        onChange={setStatus}
      />
      <label>
        Dataset file
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="form-footnote">
        {file
          ? `Will upload: ${file.name}`
          : attachedName
            ? `Attached: ${attachedName}`
            : "Optional — buyers can download only after purchase once a file is attached. Stored in the private datacuts bucket."}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={busy || !canSave}>
          {busy ? "Saving…" : "Save listing"}
        </button>
        <Link className="text-button" href="/dashboard">
          Cancel
        </Link>
      </div>
    </form>
  );
}
