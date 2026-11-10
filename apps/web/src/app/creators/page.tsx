import type { Metadata } from "next";
import Link from "next/link";
import { Verified } from "@/components/brand";
import { Icon } from "@/components/icons";
import { catalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Creators",
};

export default function CreatorsPage() {
  const creators = catalog.getCreators();

  return (
    <section className="page-view creators-view">
      <div className="page-intro creators-intro">
        <div>
          <span className="kicker">Expert storefronts</span>
          <h1>
            Meet the minds
            <br />
            behind the data.
          </h1>
          <p>
            Follow leading researchers, practitioners, and domain experts. Get updates whenever they
            publish.
          </p>
        </div>
        <div className="creator-stat">
          <strong>680+</strong>
          <span>
            verified experts
            <br />
            and growing
          </span>
        </div>
      </div>
      <div className="creator-store-grid">
        {creators.map((creator, index) => (
          <article className="creator-store" key={creator.id}>
            <Link href={`/creators/${creator.slug}`} className={`store-cover cover-${(index % 3) + 1}`}>
              <span>DATAONLY / CREATOR</span>
              <div className="cover-shape" />
            </Link>
            <div className="store-body">
              <div className="large-avatar" style={{ background: creator.color }}>
                {creator.initials}
              </div>
              <button type="button" className="follow-button">
                Follow
              </button>
              <h2>
                <Link href={`/creators/${creator.slug}`}>{creator.name}</Link>
              </h2>
              {creator.verified ? <Verified /> : null}
              <p>{creator.bio}</p>
              <div className="store-stats">
                <span>
                  <b>{creator.cuts}</b> Datacuts
                </span>
                <span>
                  <b>{creator.followers}</b> Followers
                </span>
                <span>
                  <b>4.{9 - (index % 3)}</b> Rating
                </span>
              </div>
              <div className="store-tags">
                <span>Expert-curated</span>
                <span>Commercial license</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="verified-callout">
        <div className="verified-seal">
          <Icon name="shield" size={34} />
        </div>
        <div>
          <span className="kicker">The DataOnly standard</span>
          <h2>What does verified mean?</h2>
          <p>
            Verified creators have proven professional experience, consistently high data quality,
            and a trusted track record in their field. Unverified creators can still list and sell —
            Verified is a trust boost, not a paywall.
          </p>
        </div>
        <span className="link-button">Learn about verification <Icon name="arrow" size={17} /></span>
      </div>
    </section>
  );
}
