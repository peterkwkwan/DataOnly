import Link from "next/link";
import { Verified } from "@/components/brand";
import { DatacutSection } from "@/components/datacut-card";
import { HeroSearch } from "@/components/hero-search";
import { Icon, IndustryIcon } from "@/components/icons";
import { catalog } from "@/lib/catalog";

export default function HomePage() {
  const categories = catalog.getCategories();
  const creators = catalog.getCreators().filter((c) => c.verified);
  const popular = catalog.getPopularDatacuts();

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Icon name="spark" size={16} /> The marketplace for expert data
          </div>
          <h1>
            Find the data
            <br />
            behind <em>better</em> ideas.
          </h1>
          <p>
            Discover unique, expert-curated datasets from verified creators across every industry.
          </p>
          <HeroSearch />
          <div className="popular-searches">
            <span>Popular:</span> consumer trends, healthcare, machine learning
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-ring ring-one" />
          <div className="visual-ring ring-two" />
          <div className="visual-ring ring-three" />
          <div className="core">
            <Icon name="database" size={42} />
            <span>8.2K</span>
            <small>datacuts</small>
          </div>
          <div className="float-card card-a">
            <span>01</span>
            <b>Verified</b>
            <small>expert sources</small>
          </div>
          <div className="float-card card-b">
            <span>+24%</span>
            <b>Trending</b>
            <small>energy data</small>
          </div>
          <div className="float-card card-c">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <span>Built for teams at</span>
        <b>METRIC</b>
        <b className="serif">Northstar</b>
        <b>PARALLAX</b>
        <b className="wide">FIELDWORK</b>
        <b className="serif">Signal</b>
      </section>

      <section className="section categories-section">
        <div className="section-heading">
          <div>
            <span className="kicker">Explore the marketplace</span>
            <h2>Browse by industry</h2>
          </div>
          <Link className="link-button" href="/explore">
            View all categories <Icon name="arrow" size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link className="category-card" key={category.id} href={`/explore/${category.slug}`}>
              <span className="category-index">0{index + 1}</span>
              <span className="category-symbol" style={{ backgroundColor: category.color }}>
                <IndustryIcon name={category.icon} />
              </span>
              <h3>{category.name}</h3>
              <p>{category.count} datacuts</p>
              <span className="round-arrow">
                <Icon name="arrow" size={17} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <DatacutSection
        title="Popular right now"
        subtitle="High-quality data, trusted by the community"
        cuts={popular}
      />

      <section className="creator-spotlight">
        <div className="spotlight-content">
          <span className="kicker light">Creator spotlight</span>
          <h2>
            Knowledge has value.
            <br />
            Make yours count.
          </h2>
          <p>
            Package your expertise into useful datacuts, build a following, and earn from every
            sale.
          </p>
          <Link className="lime-button" href="/creators">
            Open your data store <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="creator-stack">
          {creators.map((creator, index) => (
            <Link
              className="mini-creator"
              key={creator.id}
              href={`/creators/${creator.slug}`}
              style={{ transform: `translateX(${index * 22}px)` }}
            >
              <div className="avatar" style={{ background: creator.color }}>
                {creator.initials}
              </div>
              <div>
                <b>{creator.name}</b>
                <span>{creator.specialty}</span>
              </div>
              <Verified />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
