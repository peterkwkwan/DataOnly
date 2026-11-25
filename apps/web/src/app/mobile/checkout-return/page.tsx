import { Suspense } from "react";
import { MobileCheckoutReturnClient } from "./return-client";

/**
 * Stripe Checkout cannot always redirect straight to a custom scheme.
 * Mobile Checkout uses HTTPS success/cancel URLs that land here, then we
 * bounce into the Expo deep link so openAuthSessionAsync can dismiss.
 */
export default function MobileCheckoutReturnPage() {
  return (
    <Suspense
      fallback={
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
          <p>Returning to DataOnly…</p>
        </main>
      }
    >
      <MobileCheckoutReturnClient />
    </Suspense>
  );
}
