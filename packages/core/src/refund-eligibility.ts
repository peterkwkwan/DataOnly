export const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type RefundEligibilityInput = {
  purchaseStatus: string;
  purchaseCreatedAt: string;
  paymentIntentId: string | null;
  refundRequestedAt: string | null;
  isCurrentAccessCharge: boolean;
  entitlementStatus: string | null;
  entitlementDownloadedAt: string | null;
  now?: number;
};

export type RefundEligibilityCode =
  | "downloaded"
  | "refunded"
  | "revoked"
  | "missing_payment"
  | "already_requested"
  | "not_refundable";

export type RefundEligibilityResult =
  | { ok: true; outsideWindow: boolean }
  | { ok: false; code: RefundEligibilityCode };

export type PurchaseStatusPill = {
  label: string;
  modifier: "revoked" | "under_review" | "approved" | "submitted";
};

const INSIDE_CURRENT =
  "You haven't downloaded this datacut, and this purchase is within 14 days. Submit a request and we'll review it. If it's approved, download access is removed and the payment goes back the way it came.";
const INSIDE_OTHER =
  "This purchase is within 14 days. Submit a request and we'll review it. If it's approved, the payment goes back the way it came.";
const OUTSIDE =
  "This purchase is older than 14 days. You can still submit a request and we'll review it.";

export function isCurrentAccessCharge(
  purchasePaymentIntentId: string | null | undefined,
  entitlementPaymentIntentId: string | null | undefined,
): boolean {
  const purchasePi = purchasePaymentIntentId?.trim() || "";
  const entitlementPi = entitlementPaymentIntentId?.trim() || "";
  return purchasePi.length > 0 && purchasePi === entitlementPi;
}

export function refundEligibility(input: RefundEligibilityInput): RefundEligibilityResult {
  if (input.purchaseStatus === "refunded") return { ok: false, code: "refunded" };
  if (input.purchaseStatus !== "paid") return { ok: false, code: "not_refundable" };

  if (input.isCurrentAccessCharge && input.entitlementStatus === "revoked") {
    return { ok: false, code: "revoked" };
  }
  if (input.isCurrentAccessCharge && input.entitlementDownloadedAt?.trim()) {
    return { ok: false, code: "downloaded" };
  }
  if (
    input.isCurrentAccessCharge &&
    input.entitlementStatus !== "active" &&
    input.entitlementStatus !== "pending" &&
    input.entitlementStatus !== "refunded"
  ) {
    return { ok: false, code: "not_refundable" };
  }
  if (!input.paymentIntentId?.trim()) return { ok: false, code: "missing_payment" };
  if (input.refundRequestedAt?.trim()) return { ok: false, code: "already_requested" };

  const now = input.now ?? Date.now();
  const created = Date.parse(input.purchaseCreatedAt);
  const outsideWindow = !Number.isFinite(created) || now - created > REFUND_WINDOW_MS;
  return { ok: true, outsideWindow };
}

/** Buyer-facing help-dialog sentences. `requestedWhen` is the formatted request date. */
export function refundBuyerCopy(
  input: RefundEligibilityInput,
  requestedWhen = "",
): { canSubmit: boolean; paragraphs: string[] } {
  const result = refundEligibility(input);
  if (result.ok) {
    if (result.outsideWindow) return { canSubmit: true, paragraphs: [OUTSIDE] };
    return {
      canSubmit: true,
      paragraphs: [input.isCurrentAccessCharge ? INSIDE_CURRENT : INSIDE_OTHER],
    };
  }
  switch (result.code) {
    case "downloaded":
      return {
        canSubmit: false,
        paragraphs: ["This purchase can't be refunded because you already downloaded the datacut."],
      };
    case "already_requested":
      return {
        canSubmit: false,
        paragraphs: [
          `Request sent ${requestedWhen || "—"}. We'll review it.`,
          ...(input.isCurrentAccessCharge
            ? ["Download access stays until a refund is issued."]
            : []),
        ],
      };
    case "refunded":
      return {
        canSubmit: false,
        paragraphs: [
          "This purchase was refunded.",
          ...(input.isCurrentAccessCharge ? ["Download is no longer available."] : []),
        ],
      };
    case "revoked":
      return { canSubmit: false, paragraphs: ["Access to this datacut was revoked."] };
    case "missing_payment":
      return {
        canSubmit: false,
        paragraphs: ["This purchase has no payment to refund yet."],
      };
    default:
      return { canSubmit: false, paragraphs: ["This purchase can't be refunded."] };
  }
}

export function purchaseStatusPills(input: {
  purchaseStatus: string;
  refundRequestedAt: string | null;
  isCurrentAccessCharge: boolean;
  entitlementStatus: string | null;
}): PurchaseStatusPill[] {
  const pills: PurchaseStatusPill[] = [];
  if (input.purchaseStatus === "refunded") {
    pills.push({ label: "REFUNDED", modifier: "revoked" });
  } else if (input.isCurrentAccessCharge && input.entitlementStatus === "revoked") {
    pills.push({ label: "REVOKED", modifier: "revoked" });
  } else if (input.isCurrentAccessCharge && input.entitlementStatus === "pending") {
    pills.push({ label: "PENDING", modifier: "under_review" });
  } else if (input.purchaseStatus === "paid") {
    pills.push({ label: "PAID", modifier: "approved" });
  }
  if (input.refundRequestedAt && input.purchaseStatus !== "refunded") {
    pills.push({ label: "REQUESTED", modifier: "submitted" });
  }
  return pills;
}

export function selfCheckRefundEligibility(): void {
  const now = Date.UTC(2026, 0, 20);
  const day = 24 * 60 * 60 * 1000;
  const base: RefundEligibilityInput = {
    purchaseStatus: "paid",
    purchaseCreatedAt: new Date(now - day).toISOString(),
    paymentIntentId: "pi_1",
    refundRequestedAt: null,
    isCurrentAccessCharge: true,
    entitlementStatus: "active",
    entitlementDownloadedAt: null,
    now,
  };

  function check(label: string, result: RefundEligibilityResult, expect: RefundEligibilityResult) {
    const same =
      result.ok === expect.ok &&
      (result.ok
        ? expect.ok && result.outsideWindow === expect.outsideWindow
        : !expect.ok && result.code === expect.code);
    if (!same) {
      throw new Error(`${label}: ${JSON.stringify(result)} !== ${JSON.stringify(expect)}`);
    }
  }

  check("1 day inside", refundEligibility(base), { ok: true, outsideWindow: false });
  check(
    "exactly 14 days inside",
    refundEligibility({
      ...base,
      purchaseCreatedAt: new Date(now - REFUND_WINDOW_MS).toISOString(),
    }),
    { ok: true, outsideWindow: false },
  );
  check(
    "1 ms past 14 days",
    refundEligibility({
      ...base,
      purchaseCreatedAt: new Date(now - REFUND_WINDOW_MS - 1).toISOString(),
    }),
    { ok: true, outsideWindow: true },
  );
  check(
    "current downloaded",
    refundEligibility({ ...base, entitlementDownloadedAt: new Date(now).toISOString() }),
    { ok: false, code: "downloaded" },
  );
  check(
    "not current stays ok when downloaded",
    refundEligibility({
      ...base,
      isCurrentAccessCharge: false,
      entitlementDownloadedAt: new Date(now).toISOString(),
    }),
    { ok: true, outsideWindow: false },
  );
  check("ledger refunded", refundEligibility({ ...base, purchaseStatus: "refunded" }), {
    ok: false,
    code: "refunded",
  });
  check("current revoked", refundEligibility({ ...base, entitlementStatus: "revoked" }), {
    ok: false,
    code: "revoked",
  });
  check("missing payment", refundEligibility({ ...base, paymentIntentId: null }), {
    ok: false,
    code: "missing_payment",
  });
  check(
    "already requested",
    refundEligibility({ ...base, refundRequestedAt: new Date(now).toISOString() }),
    { ok: false, code: "already_requested" },
  );
  check("invalid created_at", refundEligibility({ ...base, purchaseCreatedAt: "not-a-date" }), {
    ok: true,
    outsideWindow: true,
  });

  if (!isCurrentAccessCharge("pi_1", "pi_1") || isCurrentAccessCharge(null, "pi_1")) {
    throw new Error("isCurrentAccessCharge");
  }
  const inside = refundBuyerCopy(base);
  if (!inside.canSubmit || !inside.paragraphs[0]?.includes("within 14 days")) {
    throw new Error("inside copy");
  }
  const pills = purchaseStatusPills({
    purchaseStatus: "paid",
    refundRequestedAt: new Date(now).toISOString(),
    isCurrentAccessCharge: true,
    entitlementStatus: "active",
  });
  if (pills.map((pill) => pill.label).join(",") !== "PAID,REQUESTED") {
    throw new Error(`pills ${pills.map((pill) => pill.label).join(",")}`);
  }
}

const entry =
  typeof globalThis !== "undefined" &&
  "process" in globalThis &&
  Array.isArray((globalThis as { process?: { argv?: string[] } }).process?.argv)
    ? ((globalThis as { process?: { argv?: string[] } }).process?.argv?.[1] ?? "")
    : "";
if (entry.includes("refund-eligibility")) {
  selfCheckRefundEligibility();
}
