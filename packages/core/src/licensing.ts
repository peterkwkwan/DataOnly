import type { LicenseTemplate } from "./types";

/** Pin on entitlement at purchase; bump when counsel finalizes template text. */
export const LICENSE_TEMPLATE_VERSION = "v1";

export const LICENSE_SUMMARIES: Record<
  LicenseTemplate,
  { title: string; allows: string; forbids: string }
> = {
  personal: {
    title: "Personal Use",
    allows: "Private / non-commercial use by the buyer.",
    forbids: "Resale, sublicensing, commercial product/service use, public redistribution.",
  },
  commercial: {
    title: "Commercial Use",
    allows: "Use inside the buyer’s business / products as stated on the listing.",
    forbids: "Redistribution as a competing dataset; transfer beyond license terms.",
  },
};

export function licenseVersionLabel(license: LicenseTemplate): string {
  return `${license}-${LICENSE_TEMPLATE_VERSION}`;
}
