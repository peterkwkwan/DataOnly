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
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>{" "}
      Verified
    </span>
  );
}
