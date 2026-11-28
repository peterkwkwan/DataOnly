"use client";

import type { Review } from "@dataonly/core";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";

type Summary = { rating: number; count: number };

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function Stars({
  value,
  onChange,
  interactive,
}: {
  value: number;
  onChange?: (n: number) => void;
  interactive?: boolean;
}) {
  return (
    <span
      className="review-stars"
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Rating" : undefined}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="review-star-btn"
          disabled={!interactive}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-checked={interactive ? value === n : undefined}
          role={interactive ? "radio" : undefined}
          onClick={() => onChange?.(n)}
        >
          <Icon name="star" size={16} filled={n <= value} />
        </button>
      ))}
    </span>
  );
}

export function DatacutReviews({
  datacutId,
  entitled,
  headerRating,
  headerReviews,
  onSummaryChange,
}: {
  datacutId: number;
  entitled: boolean;
  headerRating: number;
  headerReviews: number;
  onSummaryChange?: (summary: Summary) => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mine, setMine] = useState<Review | null>(null);
  const [summary, setSummary] = useState<Summary>({
    rating: headerRating,
    count: headerReviews,
  });
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const applySummary = useCallback(
    (next: Summary) => {
      setSummary(next);
      onSummaryChange?.(next);
    },
    [onSummaryChange],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews?datacutId=${datacutId}`);
      const data = (await res.json()) as {
        reviews?: Review[];
        mine?: Review | null;
        summary?: Summary;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load reviews");
        return;
      }
      setReviews(data.reviews ?? []);
      setMine(data.mine ?? null);
      if (data.mine) {
        setRating(data.mine.rating);
        setBody(data.mine.body ?? "");
      }
      if (data.summary) applySummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews");
    } finally {
      setLoaded(true);
    }
  }, [applySummary, datacutId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mine) {
      setRating(5);
      setBody("");
    }
  }, [mine, entitled]);

  async function save(visible = true) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datacutId,
          rating,
          body: body.trim() || null,
          visible,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        review?: Review;
        summary?: Summary;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save review");
        return;
      }
      if (data.review) setMine(data.review);
      if (data.summary) applySummary(data.summary);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="datacut-reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Reviews</h2>
      <p className="empty-hint" style={{ marginTop: 0 }}>
        <Icon name="star" size={14} filled />{" "}
        {summary.count > 0 ? (
          <>
            {summary.rating} average · {summary.count} review
            {summary.count === 1 ? "" : "s"}
          </>
        ) : (
          "No ratings yet"
        )}
      </p>

      {entitled ? (
        <div className="review-form">
          <p style={{ margin: "0 0 8px" }}>
            {mine ? "Update your rating" : "Leave a rating"}
          </p>
          <Stars value={rating} onChange={setRating} interactive />
          <label className="sr-only" htmlFor={`review-body-${datacutId}`}>
            Review (optional)
          </label>
          <textarea
            id={`review-body-${datacutId}`}
            className="review-body-input"
            rows={3}
            maxLength={500}
            placeholder="Optional — up to 500 characters"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-button small"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {busy ? "Saving…" : mine ? "Save" : "Submit"}
            </button>
            {mine?.visible ? (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <ul className="review-list">
        {reviews.map((r) => (
          <li key={r.id} className="review-item">
            <div className="review-item-head">
              <Stars value={r.rating} />
              <span className="empty-hint">
                {r.displayName?.trim() || "Buyer"} · {formatWhen(r.createdAt)}
              </span>
            </div>
            {r.body ? <p style={{ margin: "6px 0 0" }}>{r.body}</p> : null}
          </li>
        ))}
        {loaded && reviews.length === 0 ? (
          <li className="empty-hint" style={{ listStyle: "none" }}>
            No public reviews yet.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
