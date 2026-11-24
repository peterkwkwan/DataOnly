import { Icon } from "@/components/icons";

export function Logo() {
  return (
    <div className="logo" aria-label="DataOnly home">
      <span className="logo-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        Data<span>Only</span>
      </span>
    </div>
  );
}

export function Art({ type }: { type: string }) {
  return (
    <div className={`data-art ${type}`}>
      <div className="art-grid" />
      <span className="orb orb-one" />
      <span className="orb orb-two" />
      <span className="art-line line-one" />
      <span className="art-line line-two" />
      <span className="art-label">DO / {type.toUpperCase()}</span>
    </div>
  );
}

export function Verified() {
  return (
    <span className="verified" title="Verified industry expert">
      <Icon name="shield" size={14} />
      Verified
    </span>
  );
}
