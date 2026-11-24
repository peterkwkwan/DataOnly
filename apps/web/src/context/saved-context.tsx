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
  /** False until auth settles and local/cloud hydrate finishes — avoid rendering seed. */
  hydrated: boolean;
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
  /** Last persistence/hydrate failure, if any — for debugging without noisy toasts. */
  syncError: string | null;
};

const SavedContext = createContext<SavedContextValue | null>(null);
const STORAGE_KEY = "dataonly:saved";
const migratedKey = (userId: string) => `dataonly:saved-migrated:${userId}`;

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

/** Guest first-paint demo bookmarks — not real device saves to push into an empty cloud library. */
function isDemoSeedOnly(ids: number[]): boolean {
  const seed = new Set(catalog.getInitialSavedIds());
  return ids.length > 0 && ids.every((id) => seed.has(id));
}

function hasMigratedLocalSaves(userId: string): boolean {
  try {
    return window.localStorage.getItem(migratedKey(userId)) === "1";
  } catch {
    return true;
  }
}

function markLocalSavesMigrated(userId: string) {
  try {
    window.localStorage.setItem(migratedKey(userId), "1");
    // Drop device cache so an intentional empty cloud library cannot be re-seeded.
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user, configured, loading: authLoading } = useAuth();
  // Start empty — never flash demo seed (e.g. Residential Energy id 2) before hydrate.
  // Guests without localStorage get the seed only after hydrate below.
  const [savedIds, setSavedIds] = useState<number[]>([]);
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
            // Keep optimistic/current state — do not fall through to seed/local re-inject.
            setHydrated(true);
            return;
          }

          const fromDb = (data ?? [])
            .map((row) => Number(row.datacut_id))
            .filter((n) => Number.isFinite(n));
          const local = readLocalSavedIds();
          const alreadyMigrated = hasMigratedLocalSaves(user.id);
          const shouldMigrateLocal =
            fromDb.length === 0 &&
            !alreadyMigrated &&
            !!local &&
            local.length > 0 &&
            !isDemoSeedOnly(local);

          // One-time only: first signed-in session with empty cloud + real device saves.
          // Demo seed alone (e.g. Residential Energy id 2) must not re-seed after unsave.
          // After migration (or any successful cloud read), empty cloud stays empty.
          if (shouldMigrateLocal && local) {
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
              setHydrated(true);
              return;
            }
            markLocalSavesMigrated(user.id);
            setSyncError(null);
            setSavedIds(local);
            setHydrated(true);
            return;
          }

          markLocalSavesMigrated(user.id);
          setSyncError(null);
          setSavedIds(fromDb);
          setHydrated(true);
          return;
        } catch (err) {
          if (cancelled) return;
          const message = formatClientError(err, "Failed to load saved datacuts");
          console.warn("[saved]", message);
          setSyncError(message);
          setHydrated(true);
          return;
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
    // Signed-in library lives in Supabase; do not keep a parallel device cache that
    // can re-seed an intentional empty cloud library on the next hydrate.
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
            // Ensure device cache cannot revive this row on the next empty-cloud hydrate.
            markLocalSavesMigrated(user.id);
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
      hydrated,
      isSaved: (id: number) => savedIds.includes(id),
      toggleSaved,
      syncError,
    }),
    [savedIds, hydrated, toggleSaved, syncError],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
