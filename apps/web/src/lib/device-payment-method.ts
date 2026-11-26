export type DeviceCard = {
  name: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export function cardBrand(digits: string): string {
  if (digits.startsWith("34") || digits.startsWith("37")) return "Amex";
  if (digits.startsWith("4")) return "Visa";
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if ((two >= 51 && two <= 55) || (digits.length >= 4 && four >= 2221 && four <= 2720)) {
    return "Mastercard";
  }
  return "Card";
}

export function parseDeviceCard(
  input: { name: string; number: string; expiry: string; cvc: string },
  now = new Date(),
): { ok: true; card: DeviceCard } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter the name on the card." };

  const digits = input.number.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits)) {
    return { ok: false, error: "Enter a card number (13–19 digits)." };
  }

  const expiry = input.expiry.trim().match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!expiry) return { ok: false, error: "Enter an expiry as MM/YY." };
  const expMonth = Number(expiry[1]);
  const yearPart = expiry[2] ?? "";
  const expYear = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
  if (expMonth < 1 || expMonth > 12 || !Number.isFinite(expYear)) {
    return { ok: false, error: "Enter an expiry as MM/YY." };
  }
  const end = new Date(expYear, expMonth, 0, 23, 59, 59, 999);
  if (end.getTime() < now.getTime()) {
    return { ok: false, error: "That card is expired." };
  }

  if (!/^\d{3,4}$/.test(input.cvc.trim())) {
    return { ok: false, error: "Enter a 3- or 4-digit CVC." };
  }

  return {
    ok: true,
    card: {
      name,
      brand: cardBrand(digits),
      last4: digits.slice(-4),
      expMonth,
      expYear,
    },
  };
}

export function formatCardExpiry(expMonth: number, expYear: number): string {
  const mm = String(expMonth).padStart(2, "0");
  const yy = String(expYear).slice(-2).padStart(2, "0");
  return `${mm}/${yy}`;
}

function selfCheckDeviceCard(): void {
  const now = new Date(2026, 10, 26, 12, 0, 0);
  const visa = parseDeviceCard(
    { name: "Ada", number: "4242 4242 4242 4242", expiry: "12/30", cvc: "123" },
    now,
  );
  if (!visa.ok || visa.card.brand !== "Visa" || visa.card.last4 !== "4242") {
    throw new Error("visa");
  }
  if ("cvc" in visa.card || JSON.stringify(visa.card).includes("4242424242424242")) {
    throw new Error("pan stored");
  }
  const amex = parseDeviceCard(
    { name: "Ada", number: "378282246310005", expiry: "12/2030", cvc: "1234" },
    now,
  );
  if (!amex.ok || amex.card.brand !== "Amex") throw new Error("amex");
  const mc = parseDeviceCard(
    { name: "Ada", number: "5555555555554444", expiry: "11/26", cvc: "123" },
    now,
  );
  if (!mc.ok || mc.card.brand !== "Mastercard") throw new Error("mc 51-55");
  const mc2 = parseDeviceCard(
    { name: "Ada", number: "2221000000000009", expiry: "01/30", cvc: "123" },
    now,
  );
  if (!mc2.ok || mc2.card.brand !== "Mastercard") throw new Error("mc 2221");
  const other = parseDeviceCard(
    { name: "Ada", number: "6011111111111117", expiry: "12/30", cvc: "123" },
    now,
  );
  if (!other.ok || other.card.brand !== "Card") throw new Error("other brand");
  const short = parseDeviceCard(
    { name: "Ada", number: "424242424242", expiry: "12/30", cvc: "123" },
    now,
  );
  if (short.ok) throw new Error("short pan");
  const expired = parseDeviceCard(
    { name: "Ada", number: "4242424242424242", expiry: "10/26", cvc: "123" },
    now,
  );
  if (expired.ok) throw new Error("expired");
  const monthEnd = parseDeviceCard(
    { name: "Ada", number: "4242424242424242", expiry: "11/26", cvc: "12" },
    new Date(2026, 10, 30, 23, 0, 0),
  );
  if (monthEnd.ok) throw new Error("cvc");
  const stillValid = parseDeviceCard(
    { name: "Ada", number: "4242424242424242", expiry: "11/26", cvc: "123" },
    new Date(2026, 10, 30, 23, 0, 0),
  );
  if (!stillValid.ok) throw new Error("month end");
  if (parseDeviceCard({ name: "  ", number: "4242424242424242", expiry: "12/30", cvc: "123" }, now).ok) {
    throw new Error("name");
  }
}

const entry =
  typeof globalThis !== "undefined" &&
  "process" in globalThis &&
  Array.isArray((globalThis as { process?: { argv?: string[] } }).process?.argv)
    ? ((globalThis as { process?: { argv?: string[] } }).process?.argv?.[1] ?? "")
    : "";
if (entry.includes("device-payment-method")) {
  selfCheckDeviceCard();
}
