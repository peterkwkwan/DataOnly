"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export function MobileCheckoutReturnClient() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(() => {
    const to = searchParams.get("to")?.trim() || "";
    const status = searchParams.get("status") === "cancel" ? "cancel" : "success";
    const sessionId = searchParams.get("session_id")?.trim() || "";
    if (!to) return null;
    try {
      const url = new URL(to);
      if (!["dataonlymobile:", "exp:", "exps:"].includes(url.protocol)) {
        return null;
      }
      url.searchParams.set("checkout", status);
      if (sessionId) url.searchParams.set("session_id", sessionId);
      return url.toString();
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!target) {
      setError("Invalid return link. You can close this tab and go back to the DataOnly app.");
      return;
    }
    window.location.href = target;
  }, [target]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#f6f7f2",
        color: "#101b18",
      }}
    >
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        <p style={{ fontSize: 12, letterSpacing: 1, fontWeight: 700, opacity: 0.55 }}>DATAONLY</p>
        <h1 style={{ fontSize: 22, margin: "10px 0 8px" }}>
          {error ? "Couldn’t return to app" : "Returning to DataOnly…"}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.75 }}>
          {error ??
            "If the app doesn’t open, switch back to DataOnly manually. Your payment status will refresh there."}
        </p>
        {target && !error ? (
          <p style={{ marginTop: 18 }}>
            <a href={target} style={{ color: "#101b18", fontWeight: 700 }}>
              Open DataOnly
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
