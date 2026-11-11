"use client";

import { catalog } from "@/lib/catalog";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";

type SavedContextValue = {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);
const STORAGE_KEY = "dataonly:saved";

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user, configured, loading: authLoading } = useAuth();
  const [savedIds, setSavedIds] = useState<number[]>(() => catalog.getInitialSavedIds());
  const [hydrated, setHydrated] = useState(false);

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
          if (!error && data && !cancelled) {
            setSavedIds(data.map((row) => Number(row.datacut_id)));
            setHydrated(true);
            return;
          }
        } catch {
          /* fall through to localStorage */
        }
      }

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as number[];
          if (Array.isArray(parsed) && !cancelled) setSavedIds(parsed);
        } else if (!cancelled) {
          setSavedIds(catalog.getInitialSavedIds());
        }
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
      setSavedIds((current) => {
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id];

        if (configured && user) {
          const supabase = createBrowserSupabaseClient();
          if (current.includes(id)) {
            void supabase.from("saved").delete().eq("user_id", user.id).eq("datacut_id", id);
          } else {
            void supabase.from("saved").upsert({ user_id: user.id, datacut_id: id });
          }
        }

        return next;
      });
    },
    [configured, user],
  );

  const value = useMemo(
    () => ({
      savedIds,
      isSaved: (id: number) => savedIds.includes(id),
      toggleSaved,
    }),
    [savedIds, toggleSaved],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
