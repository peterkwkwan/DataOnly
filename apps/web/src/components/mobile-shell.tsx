"use client";

import type { Datacut } from "@dataonly/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Art, Logo, Verified } from "@/components/brand";
import { Icon, IndustryIcon } from "@/components/icons";
import { useSaved } from "@/context/saved-context";
import { catalog } from "@/lib/catalog";

type MobileScreen = "home" | "explore" | "creators" | "saved";

function MobileCutCard({ cut }: { cut: Datacut }) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(cut.id);
  return (
    <article className="m-cut-card">
      <Link href={`/datacuts/${cut.slug}`} className="m-cut-art" style={{ background: cut.accent }}>
        <Art type={cut.art} />
        <span>{cut.categoryName}</span>
      </Link>
      <button
        type="button"
        className={saved ? "saved" : ""}
        onClick={() => toggleSaved(cut.id)}
        aria-label="Save datacut"
      >
        <Icon name="bookmark" size={17} filled={saved} />
      </button>
      <div className="m-cut-copy">
        <small>
          {cut.creatorName} <Icon name="shield" size={11} />
        </small>
        <h3>
          <Link href={`/datacuts/${cut.slug}`}>{cut.title}</Link>
        </h3>
        <div>
          <span>
            <Icon name="star" size={12} filled /> {cut.rating}
          </span>
          <b>${cut.price}</b>
        </div>
      </div>
    </article>
  );
}

export function MobileShell() {
  const categories = catalog.getCategories();
  const creators = catalog.getCreators();
  const datacuts = catalog.getDatacuts();
  const { savedIds, isSaved, toggleSaved } = useSaved();

  const [screen, setScreen] = useState<MobileScreen>("home");
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(
    () =>
      datacuts.filter(
        (cut) => activeCategory === "All" || cut.categoryName === activeCategory,
      ),
    [datacuts, activeCategory],
  );

  const goToCategory = (name: string) => {
    setActiveCategory(name);
    setScreen("explore");
  };

  return (
    <div className="mobile-app-prototype">
      <div className="mobile-statusbar">
        <span>9:41</span>
        <div>
          <i />
          <i />
          <i />
        </div>
      </div>

      {screen === "home" && (
        <div className="mobile-screen mobile-home-screen">
          <header className="m-app-header">
            <Logo />
            <button type="button" className="m-profile-button">
              AR
            </button>
          </header>
          <section className="m-welcome">
            <span>Good morning, Alex</span>
            <h1>
              What data will
              <br />
              move you forward?
            </h1>
            <button type="button" className="m-search-trigger" onClick={() => setMobileSearch(true)}>
              <Icon name="search" size={19} />
              <span>Search industries or datacuts</span>
            </button>
          </section>
          <section className="m-section">
            <div className="m-section-title">
              <h2>Explore industries</h2>
              <button type="button" onClick={() => setScreen("explore")}>
                See all
              </button>
            </div>
            <div className="m-category-scroll">
              {categories.map((category) => (
                <button key={category.name} type="button" onClick={() => goToCategory(category.name)}>
                  <span style={{ background: category.color }}>
                    <IndustryIcon name={category.icon} />
                  </span>
                  <b>{category.name}</b>
                  <small>{category.count}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="m-section m-trending">
            <div className="m-section-title">
              <div>
                <small>CURATED FOR YOU</small>
                <h2>Trending now</h2>
              </div>
              <button type="button" onClick={() => setScreen("explore")}>
                View all
              </button>
            </div>
            <div className="m-cut-scroll">
              {datacuts.slice(0, 3).map((cut) => (
                <MobileCutCard key={cut.id} cut={cut} />
              ))}
            </div>
          </section>
          <button type="button" className="m-seller-banner" onClick={() => setScreen("creators")}>
            <span>
              <Icon name="database" size={24} />
            </span>
            <div>
              <small>FOR CREATORS</small>
              <b>Turn expertise into income</b>
            </div>
            <Icon name="arrow" size={20} />
          </button>
        </div>
      )}

      {screen === "explore" && (
        <div className="mobile-screen mobile-explore-screen">
          <header className="m-page-header">
            <div>
              <span>MARKETPLACE</span>
              <h1>Explore</h1>
            </div>
            <button type="button" onClick={() => setMobileSearch(true)}>
              <Icon name="search" />
            </button>
          </header>
          <div className="m-filter-chips">
            {["All", ...categories.map((c) => c.name)].map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="m-results-meta">
            <span>{activeCategory === "All" ? "Popular datacuts" : activeCategory}</span>
            <button type="button">
              Popular <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="m-result-list">
            {filtered.map((cut) => (
              <article className="m-result-card" key={cut.id}>
                <Link href={`/datacuts/${cut.slug}`} className="m-result-art" style={{ background: cut.accent }}>
                  <Art type={cut.art} />
                </Link>
                <div className="m-result-copy">
                  <small>{cut.categoryName}</small>
                  <h3>
                    <Link href={`/datacuts/${cut.slug}`}>{cut.title}</Link>
                  </h3>
                  <span>
                    {cut.creatorName} <Icon name="shield" size={11} />
                  </span>
                  <div>
                    <span>
                      <Icon name="star" size={12} filled /> {cut.rating}
                    </span>
                    <b>${cut.price}</b>
                  </div>
                </div>
                <button
                  type="button"
                  className={isSaved(cut.id) ? "saved" : ""}
                  onClick={() => toggleSaved(cut.id)}
                >
                  <Icon name="bookmark" size={17} filled={isSaved(cut.id)} />
                </button>
              </article>
            ))}
            {filtered.length === 0 && (
              <div className="m-empty-state">
                <Icon name="layers" size={28} />
                <h3>More data coming soon</h3>
                <p>Follow this industry to hear about new datacuts.</p>
                <button type="button" onClick={() => setActiveCategory("All")}>
                  Browse all data
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === "creators" && (
        <div className="mobile-screen mobile-creators-screen">
          <header className="m-page-header">
            <div>
              <span>EXPERT STOREFRONTS</span>
              <h1>Creators</h1>
            </div>
            <Link href="/creators">
              <Icon name="users" />
            </Link>
          </header>
          <div className="m-featured-creator">
            <div className="m-creator-cover">
              <span>FEATURED CREATOR</span>
              <div />
            </div>
            <div className="m-creator-info">
              <div className="large-avatar" style={{ background: creators[0].color }}>
                {creators[0].initials}
              </div>
              <button type="button">Follow</button>
              <h2>
                <Link href={`/creators/${creators[0].slug}`}>{creators[0].name}</Link>
              </h2>
              {creators[0].verified ? <Verified /> : null}
              <p>{creators[0].bio}</p>
              <div>
                <span>
                  <b>{creators[0].cuts}</b> Datacuts
                </span>
                <span>
                  <b>{creators[0].followers}</b> Followers
                </span>
                <span>
                  <b>4.9</b> Rating
                </span>
              </div>
            </div>
          </div>
          <section className="m-section">
            <div className="m-section-title">
              <h2>Creators to follow</h2>
              <Link href="/creators">View all</Link>
            </div>
            <div className="m-creator-list">
              {creators.slice(1).map((creator) => (
                <article key={creator.name}>
                  <Link href={`/creators/${creator.slug}`} className="avatar" style={{ background: creator.color }}>
                    {creator.initials}
                  </Link>
                  <div>
                    <b>
                      <Link href={`/creators/${creator.slug}`}>{creator.name}</Link>
                    </b>
                    <small>
                      {creator.specialty} · {creator.cuts} datacuts
                    </small>
                  </div>
                  <button type="button">Follow</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {screen === "saved" && (
        <div className="mobile-screen mobile-saved-screen">
          <header className="m-page-header">
            <div>
              <span>YOUR LIBRARY</span>
              <h1>Saved</h1>
            </div>
            <button type="button">
              <Icon name="bookmark" filled />
            </button>
          </header>
          <div className="m-library-summary">
            <div>
              <strong>{savedIds.length}</strong>
              <span>Saved datacuts</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Following</span>
            </div>
          </div>
          <div className="m-result-list">
            {datacuts
              .filter((cut) => savedIds.includes(cut.id))
              .map((cut) => (
                <article className="m-result-card" key={cut.id}>
                  <Link href={`/datacuts/${cut.slug}`} className="m-result-art" style={{ background: cut.accent }}>
                    <Art type={cut.art} />
                  </Link>
                  <div className="m-result-copy">
                    <small>{cut.categoryName}</small>
                    <h3>
                      <Link href={`/datacuts/${cut.slug}`}>{cut.title}</Link>
                    </h3>
                    <span>{cut.creatorName}</span>
                    <div>
                      <span>{cut.records} records</span>
                      <b>${cut.price}</b>
                    </div>
                  </div>
                  <button type="button" className="saved" onClick={() => toggleSaved(cut.id)}>
                    <Icon name="bookmark" size={17} filled />
                  </button>
                </article>
              ))}
            {savedIds.length === 0 && (
              <div className="m-empty-state">
                <Icon name="bookmark" size={28} />
                <h3>Your library is empty</h3>
                <p>Save datacuts to compare or purchase later.</p>
                <button type="button" onClick={() => setScreen("explore")}>
                  Explore marketplace
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mobileSearch && (
        <div className="m-search-screen">
          <div className="m-search-top">
            <button type="button" onClick={() => setMobileSearch(false)}>
              <Icon name="arrow" size={21} />
            </button>
            <div>
              <Icon name="search" size={18} />
              <input
                autoFocus
                value={mobileQuery}
                onChange={(event) => setMobileQuery(event.target.value)}
                placeholder="Search DataOnly"
              />
              {mobileQuery ? (
                <button type="button" onClick={() => setMobileQuery("")}>
                  <Icon name="close" size={16} />
                </button>
              ) : null}
            </div>
          </div>
          <span className="m-search-label">
            {mobileQuery ? "MATCHING INDUSTRIES" : "POPULAR INDUSTRIES"}
          </span>
          <div className="m-search-categories">
            {categories
              .filter((category) =>
                category.name.toLowerCase().includes(mobileQuery.toLowerCase()),
              )
              .map((category) => (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => {
                    goToCategory(category.name);
                    setMobileSearch(false);
                  }}
                >
                  <span style={{ background: category.color }}>
                    <IndustryIcon name={category.icon} />
                  </span>
                  <div>
                    <b>{category.name}</b>
                    <small>{category.count} datacuts</small>
                  </div>
                  <Icon name="arrow" size={17} />
                </button>
              ))}
          </div>
          <div className="m-recent-searches">
            <span>RECENT SEARCHES</span>
            <Link href="/search?q=Market%20sentiment" onClick={() => setMobileSearch(false)}>
              Market sentiment <Icon name="close" size={14} />
            </Link>
            <Link href="/search?q=Biomechanics" onClick={() => setMobileSearch(false)}>
              Biomechanics <Icon name="close" size={14} />
            </Link>
          </div>
        </div>
      )}

      {!mobileSearch && (
        <nav className="mobile-app-nav">
          <button
            type="button"
            className={screen === "home" ? "active" : ""}
            onClick={() => setScreen("home")}
          >
            <Icon name="home" />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={screen === "explore" ? "active" : ""}
            onClick={() => setScreen("explore")}
          >
            <Icon name="layers" />
            <span>Explore</span>
          </button>
          <button type="button" className="m-nav-search" onClick={() => setMobileSearch(true)}>
            <Icon name="search" />
          </button>
          <button
            type="button"
            className={screen === "creators" ? "active" : ""}
            onClick={() => setScreen("creators")}
          >
            <Icon name="users" />
            <span>Creators</span>
          </button>
          <button
            type="button"
            className={screen === "saved" ? "active" : ""}
            onClick={() => setScreen("saved")}
          >
            <Icon name="bookmark" filled={screen === "saved"} />
            <span>Saved</span>
          </button>
        </nav>
      )}
    </div>
  );
}
