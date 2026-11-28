"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DatacutCard } from "@/components/datacut-card";
import { MenuSelect } from "@/components/menu-select";
import { useSaved } from "@/context/saved-context";
import {
  applyExploreQuery,
  EXPLORE_SORT_OPTIONS,
  parseExploreQuery,
  serializeExploreQuery,
  type Datacut,
  type ExploreQuery,
  type ExploreSort,
} from "@dataonly/core";

type Props = {
  cuts: Datacut[];
  heading: string;
};

function ExploreResultsInner({ cuts, heading }: Props) {
  const searchParams = useSearchParams();
  const { savedIds } = useSaved();
  const [query, setQuery] = useState<ExploreQuery>(() => parseExploreQuery(searchParams));

  const visible = applyExploreQuery(cuts, query, savedIds);

  function setSort(sort: ExploreSort) {
    const next: ExploreQuery = { ...query, sort };
    setQuery(next);
    const qs = serializeExploreQuery(next);
    const path = window.location.pathname;
    window.history.replaceState(null, "", qs ? `${path}?${qs}` : path);
  }

  return (
    <>
      <div className="results-header">
        <div>
          <h2>{heading}</h2>
          <span>{visible.length} results</span>
        </div>
        <MenuSelect
          label="Sort"
          layout="inline"
          className="explore-sort"
          value={query.sort}
          options={EXPLORE_SORT_OPTIONS}
          onChange={setSort}
        />
      </div>
      <div className="category-layout">
        <aside>
          <b>Refine results</b>
          <label>Data format</label>
          {["CSV", "JSON", "Parquet", "Images"].map((filter) => (
            <button key={filter} type="button">
              <span className="checkbox" />
              {filter}
              <small>{20 + filter.length * 7}</small>
            </button>
          ))}
          <label>License</label>
          {["Commercial use", "Research", "Attribution"].map((filter) => (
            <button key={filter} type="button">
              <span className="checkbox" />
              {filter}
            </button>
          ))}
        </aside>
        <div className="datacut-grid page-grid">
          {visible.map((cut) => (
            <DatacutCard key={cut.id} cut={cut} />
          ))}
        </div>
      </div>
    </>
  );
}

export function ExploreResults(props: Props) {
  return (
    <Suspense
      fallback={
        <>
          <div className="results-header">
            <div>
              <h2>{props.heading}</h2>
              <span>{props.cuts.length} results</span>
            </div>
          </div>
          <div className="category-layout">
            <aside>
              <b>Refine results</b>
            </aside>
            <div className="datacut-grid page-grid">
              {props.cuts.map((cut) => (
                <DatacutCard key={cut.id} cut={cut} />
              ))}
            </div>
          </div>
        </>
      }
    >
      <ExploreResultsInner {...props} />
    </Suspense>
  );
}
