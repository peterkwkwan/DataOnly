"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  creatorId: string;
  creatorSlug: string;
  creatorUserId?: string | null;
  creatorName?: string;
  initialFollowers: string;
};

function parseFollowerCount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readFollowerDisplays(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-followers]"), (el) =>
    el.textContent ?? "",
  );
}

function paintFollowerCounts(count: number | string) {
  const text = String(count);
  document.querySelectorAll<HTMLElement>("[data-followers]").forEach((el) => {
    el.textContent = text;
  });
}

function restoreFollowerDisplays(values: string[]) {
  document.querySelectorAll<HTMLElement>("[data-followers]").forEach((el, i) => {
    if (values[i] !== undefined) el.textContent = values[i];
  });
}

export function FollowButton({
  creatorId,
  creatorSlug,
  creatorUserId = null,
  creatorName,
  initialFollowers,
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const [following, setFollowing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(() => parseFollowerCount(initialFollowers));

  const isOwn = !!user && !!creatorUserId && user.id === creatorUserId;

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function hydrate() {
      if (!isSupabaseConfigured() || !user || isOwn) {
        if (!cancelled) {
          setFollowing(false);
          setHydrated(true);
        }
        return;
      }

      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: selectError } = await supabase
          .from("follows")
          .select("creator_id")
          .eq("user_id", user.id)
          .eq("creator_id", creatorId)
          .maybeSingle();
        if (cancelled) return;
        if (selectError) {
          console.warn("[follow]", formatClientError(selectError, "Failed to load follow state"));
          setHydrated(true);
          return;
        }
        setFollowing(!!data);
      } catch (err) {
        if (!cancelled) {
          console.warn("[follow]", formatClientError(err, "Failed to load follow state"));
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, creatorId, isOwn]);

  if (isOwn) return null;

  async function toggle() {
    setError(null);

    if (!isSupabaseConfigured() || !user) {
      window.location.href = `/auth/sign-in?next=${encodeURIComponent(`/creators/${creatorSlug}`)}`;
      return;
    }

    if (busy || !hydrated) return;

    const next = !following;
    const prevCount = followerCount;
    const prevDisplays = readFollowerDisplays();
    const nextCount = Math.max(0, prevCount + (next ? 1 : -1));
    setFollowing(next);
    setFollowerCount(nextCount);
    paintFollowerCounts(nextCount);
    setBusy(true);

    try {
      const supabase = createBrowserSupabaseClient();
      if (next) {
        const { error: insertError } = await supabase.from("follows").insert({
          user_id: user.id,
          creator_id: creatorId,
        });
        if (insertError) throw insertError;
      } else {
        const { error: deleteError } = await supabase
          .from("follows")
          .delete()
          .eq("user_id", user.id)
          .eq("creator_id", creatorId);
        if (deleteError) throw deleteError;
      }
    } catch (err) {
      setFollowing(!next);
      setFollowerCount(prevCount);
      restoreFollowerDisplays(prevDisplays);
      setError(formatClientError(err, next ? "Couldn't follow" : "Couldn't unfollow"));
    } finally {
      setBusy(false);
    }
  }

  const label = following ? "Following" : "Follow";
  const ariaLabel = creatorName
    ? following
      ? `Unfollow ${creatorName}`
      : `Follow ${creatorName}`
    : following
      ? "Unfollow"
      : "Follow";

  return (
    <>
      <button
        type="button"
        className={following ? "follow-button following" : "follow-button"}
        aria-pressed={following}
        aria-label={ariaLabel}
        disabled={busy || authLoading}
        onClick={() => void toggle()}
      >
        {label}
      </button>
      {error ? <p className="form-error follow-error">{error}</p> : null}
    </>
  );
}
