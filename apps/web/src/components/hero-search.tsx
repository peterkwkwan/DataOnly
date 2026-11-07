"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { catalog } from "@/lib/catalog";

export function HeroSearch({
  initialCategory = "All data",
}: {
  initialCategory?: string;
}) {
  const router = useRouter();
  const categories = catalog.getCategories();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const suggestions = useMemo(() => catalog.searchAutocomplete(query), [query]);

  const submit = (value = query) => {
    const q = value.trim();
    const category = categories.find((c) => c.name === q || c.name === selectedCategory);
    if (category && (!q || category.name === q)) {
      router.push(`/explore/${category.slug}`);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q || selectedCategory)}`);
  };

  return (
    <div className="search-wrap">
      <div className={`hero-search ${searchOpen ? "focused" : ""}`}>
        <Icon name="search" size={22} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="What kind of data are you looking for?"
        />
        <button
          type="button"
          className="category-select"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          {selectedCategory} <Icon name="chevron" size={15} />
        </button>
        <button type="button" className="search-button" aria-label="Search" onClick={() => submit()}>
          <Icon name="arrow" size={20} />
        </button>
      </div>
      {searchOpen && (
        <div className="suggestions">
          <span className="suggestions-label">
            {query ? "Matching industries" : "Popular categories"}
          </span>
          {(query
            ? suggestions.map((s) => s.label)
            : categories.slice(0, 5).map((c) => c.name)
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setQuery(item);
                const match = categories.find((c) => c.name === item);
                setSelectedCategory(match ? match.name : "All data");
                setSearchOpen(false);
                if (match) router.push(`/explore/${match.slug}`);
                else router.push(`/search?q=${encodeURIComponent(item)}`);
              }}
            >
              <span className="suggestion-icon">
                <Icon name="layers" size={16} />
              </span>
              <span>
                {item}
                <small>Browse curated {item.toLowerCase()} data</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
