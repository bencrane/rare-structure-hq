/**
 * Deal intake — the capital-provider intake answers and their compilation into
 * a market-collections count request (operator rulings 2026-07-16):
 *
 * - Industry families → union of collections (union only ever GROWS the
 *   universe — collections are disjoint pair sets; no intersection anywhere).
 *   No families selected = all 22 collections.
 * - Minimum deal size → min_won floor on FY23–25 won. This is definitional,
 *   not a proxy: the partner lends against the firm's whole federal book, so
 *   FY23–25 won IS the size referent. Sweet spot is display emphasis only.
 * - Geography (lending jurisdictions) → based_in (borrower domicile).
 * - Capital products → stat emphasis on the card, never collection selection.
 *
 * Prospect-facing vocabulary only — internal collection slugs never surface.
 */
import type { CollectionsCountRequest } from "./api";

// ── Industry families (prospect-facing labels; slugs are ours) ───────────────

export const INDUSTRY_FAMILIES: { key: string; label: string; slugs: string[] }[] = [
  {
    key: "staffing",
    label: "Staffing",
    slugs: [
      "medical-clinical-staffing",
      "federal-it-staffing",
      "engineering-technical-staffing",
      "program-management-support-staffing",
      "administrative-office-support-staffing",
    ],
  },
  {
    key: "facilities",
    label: "Facilities Operations",
    slugs: ["facilities-support-operations-v2"],
  },
  {
    key: "building_services",
    label: "Building Services",
    slugs: ["building-services-v2"],
  },
  {
    key: "security",
    label: "Security & Protective Services",
    slugs: ["security-protective-services-v2"],
  },
  {
    key: "waste",
    label: "Waste & Sanitation",
    slugs: ["waste-management-sanitation"],
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    slugs: [
      "aerospace-defense-space-manufacturing",
      "industrial-machinery-components-manufacturing",
      "medical-devices-supplies-manufacturing",
      "food-production",
      "clothing-textiles",
    ],
  },
  {
    key: "construction",
    label: "Construction",
    slugs: ["equipment-heavy-construction"],
  },
  {
    key: "environmental",
    label: "Environmental & Land Management",
    slugs: ["environmental-remediation-services", "wildland-fire-forestry-services"],
  },
  {
    key: "transportation",
    label: "Transportation & Logistics",
    slugs: [
      "sealift-marine-services",
      "air-charter-cargo",
      "aviation-maintenance-support",
      "warehousing-distribution",
      "ground-transportation-freight",
    ],
  },
];

export const ALL_COLLECTION_SLUGS: string[] = INDUSTRY_FAMILIES.flatMap((f) => f.slugs);

// ── Capital products (F1) ─────────────────────────────────────────────────────

export type CapitalProduct =
  | "ar_factoring"
  | "abl_revolver"
  | "equipment_finance"
  | "unsecured_wc"
  | "po_mobilization";

export const CAPITAL_PRODUCTS: { key: CapitalProduct; label: string }[] = [
  { key: "ar_factoring", label: "Accounts Receivable (AR) Factoring" },
  { key: "abl_revolver", label: "Asset-Based Lending (ABL) / Revolving Lines of Credit" },
  { key: "equipment_finance", label: "Equipment Finance / Leasing" },
  { key: "unsecured_wc", label: "Unsecured Short-Term Working Capital (Lump Sum)" },
  { key: "po_mobilization", label: "Purchase Order (PO) / Mobilization Finance" },
];

// ── Deal sizes (F2/F3) — stored as numbers, labels are UI only ───────────────

export const MIN_DEAL_OPTIONS: { label: string; floor: number }[] = [
  { label: "Under $100,000", floor: 0 },
  { label: "$100,000 to $250,000", floor: 100_000 },
  { label: "$250,000 to $1,000,000", floor: 250_000 },
  { label: "$1,000,000+", floor: 1_000_000 },
];

export const SWEET_SPOT_OPTIONS: string[] = [
  "$100,000 to $500,000",
  "$500,000 to $2,000,000",
  "$2,000,000 to $5,000,000",
  "$5,000,000+",
];

// ── The intake draft + compile ────────────────────────────────────────────────

export type DealIntakeDraft = {
  products: CapitalProduct[];
  industries: string[]; // family keys; empty = all
  minDealLabel: string; // "" = no floor
  sweetSpotLabel: string; // display emphasis only
  nationwide: boolean;
  states: string; // free-typed state codes when not nationwide
  govReceivables: "" | "yes" | "no" | "unsure";
};

export const EMPTY_DEAL_INTAKE: DealIntakeDraft = {
  products: [],
  industries: [],
  minDealLabel: "",
  sweetSpotLabel: "",
  nationwide: true,
  states: "",
  govReceivables: "",
};

export function compileIntake(
  d: DealIntakeDraft,
  parseStates: (raw: string) => string[] | null | undefined,
): CollectionsCountRequest {
  const families =
    d.industries.length === 0
      ? INDUSTRY_FAMILIES
      : INDUSTRY_FAMILIES.filter((f) => d.industries.includes(f.key));
  const req: CollectionsCountRequest = {
    collections: families.flatMap((f) => f.slugs),
  };
  const floor = MIN_DEAL_OPTIONS.find((o) => o.label === d.minDealLabel)?.floor;
  if (floor) req.min_won = floor;
  if (!d.nationwide) {
    const states = parseStates(d.states);
    if (states) req.based_in = states;
  }
  return req;
}
