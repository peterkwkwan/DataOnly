"use client";

import { catalog } from "@/lib/catalog";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";

type SavedContextValue = {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
  /** Last persistence/hydrate failure, if any — for debugging without noisy toasts. */
  syncError: string | null;
};

const SavedContext = createContext<SavedContextValue | null>(null);
const STORAGE_KEY = "dataonly:saved";

function readLocalSavedIds(): number[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map(Number).filter((n) => Number.isFinite(n));
  } catch {
    return null;
  }
}

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user, configured, loading: authLoading } = useAuth();
  const [savedIds, setSavedIds] = useState<number[]>(() => catalog.getInitialSavedIds());
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function hydrate() {
      if (configured && user) {
        try {
          const supabase = createBrowserSupabaseClient();
          const { data, error } = await supabase
            .from("saved")
            .select("datacut_id")
            .eq("user_id", user.id);
          if (cancelled) return;

          if (error) {
            const message = formatClientError(error, "Failed to load saved datacuts");
            console.warn("[saved]", message);
            setSyncError(message);
            // Keep local/optimistic state; fall through to localStorage only as a last resort below.
          } else {
            const fromDb = (data ?? []).map((row) => Number(row.datacut_id)).filter((n) => Number.isFinite(n));
            const local = readLocalSavedIds();

            // First signed-in session with empty cloud library: push device saves up once.
            if (fromDb.length === 0 && local && local.length > 0) {
              const { error: upsertError } = await supabase.from("saved").upsert(
                local.map((datacut_id) => ({ user_id: user.id, datacut_id })),
                { onConflict: "user_id,datacut_id" },
              );
              if (cancelled) return;
              if (upsertError) {
                const message = formatClientError(upsertError, "Failed to sync local saves");
                console.warn("[saved]", message);
                setSyncError(message);
                setSavedIds(local);
              } else {
                setSyncError(null);
                setSavedIds(local);
              }
              setHydrated(true);
              return;
            }

            setSyncError(null);
            setSavedIds(fromDb);
            setHydrated(true);
            return;
          }
        } catch (err) {
          if (cancelled) return;
          const message = formatClientError(err, "Failed to load saved datacuts");
          console.warn("[saved]", message);
          setSyncError(message);
        }
      }

      try {
        const local = readLocalSavedIds();
        if (cancelled) return;
        if (local) setSavedIds(local);
        else setSavedIds(catalog.getInitialSavedIds());
      } catch {
        /* ignore */
      }
      if (!cancelled) setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (configured && user) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
  }, [savedIds, hydrated, configured, user]);

  const toggleSaved = useCallback(
    (id: number) => {
      const previous = savedIdsRef.current;
      const removing = previous.includes(id);
      const next = removing ? previous.filter((item) => item !== id) : [...previous, id];
      setSavedIds(next);

      if (!(configured && user)) return;

      // supabase-js builders are lazy thenables — must await/.then() or the HTTP
      // request never fires (void alone drops the builder).
      void (async () => {
        try {
          const supabase = createBrowserSupabaseClient();
          if (removing) {
            const { error } = await supabase
              .from("saved")
              .delete()
              .eq("user_id", user.id)
              .eq("datacut_id", id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("saved")
              .upsert({ user_id: user.id, datacut_id: id }, { onConflict: "user_id,datacut_id" });
            if (error) throw error;
          }
          setSyncError(null);
        } catch (err) {
          const message = formatClientError(err, removing ? "Failed to unsave" : "Failed to save");
          console.warn("[saved]", message);
          setSyncError(message);
          // Roll back optimistic update if nothing newer replaced it.
          setSavedIds((current) => {
            const stillMatches =
              current.length === next.length && current.every((value, i) => value === next[i]);
            return stillMatches ? previous : current;
          });
        }
      })();
    },
    [configured, user],
  );

  const value = useMemo(
    () => ({
      savedIds,
      isSaved: (id: number) => savedIds.includes(id),
      toggleSaved,
      syncError,
    }),
    [savedIds, toggleSaved, syncError],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
