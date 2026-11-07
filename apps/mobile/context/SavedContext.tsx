import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { catalog } from "@/lib/catalog";

type SavedContextValue = {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<number[]>(() => catalog.getInitialSavedIds());

  const value = useMemo<SavedContextValue>(
    () => ({
      savedIds,
      isSaved: (id) => savedIds.includes(id),
      toggleSaved: (id) => {
        setSavedIds((current) =>
          current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
        );
      },
    }),
    [savedIds],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
