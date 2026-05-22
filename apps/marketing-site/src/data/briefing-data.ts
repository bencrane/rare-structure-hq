export type BriefingPhase = "national" | "state-focus" | "sector-drill" | "cross-ref" | "cta";

export type NarrativeSectionData = {
  id: BriefingPhase;
  eyebrow: string;
  headline: string;
  body: string;
  stat?: { value: string; label: string };
  align: "left" | "right" | "center";
};

export type ContractPoint = {
  id: string;
  x: number;
  y: number;
  value: number;
  hasUCC: boolean;
};

export type MaskedField = {
  label: string;
  value: string;
};

// FIPS codes for focus states.
export const FOCUS_STATE_IDS = new Set(["06", "12", "08"]); // CA, FL, CO

export const NARRATIVE_SECTIONS: NarrativeSectionData[] = [
  {
    id: "national",
    eyebrow: "01 / National View",
    headline: "8,412 active mid-market federal contract awards.",
    body: "Since January 2026, the federal government has awarded over $14.2 billion in prime contracts to mid-market firms. These mandates create immediate mobilization pressure and working capital demand across 50 states.",
    stat: { value: "$14.2B", label: "tracked contract value" },
    align: "left",
  },
  {
    id: "state-focus",
    eyebrow: "02 / State Concentration",
    headline: "Three states account for 34% of construction-sector awards.",
    body: "California, Florida, and Colorado concentrate the highest density of construction prime awardees with active contract performance periods. This is where the mobilization capital demand is structurally deepest.",
    stat: { value: "2,861", label: "active awardees in CA / FL / CO" },
    align: "right",
  },
  {
    id: "sector-drill",
    eyebrow: "03 / Sector Drill — California Construction",
    headline: "$2.1B across 847 active prime awards.",
    body: "California construction prime contractors represent the densest single-state, single-sector cohort in our pipeline. Average award size $2.5M. 73% are in active performance — mobilizing now.",
    stat: { value: "847", label: "CA construction primes" },
    align: "left",
  },
  {
    id: "cross-ref",
    eyebrow: "04 / Leverage Signal — UCC Cross-Reference",
    headline: "68% hold active UCC-1 filings.",
    body: "We track the exact intersection where sovereign revenue winners are also active commercial debtors. These firms are credit-literate, asset-heavy, and operationally structured for sophisticated capital facilities.",
    stat: { value: "68%", label: "with active UCC liens" },
    align: "right",
  },
];

// ~20 dummy contract points inside California's SVG bounds (x:55-185, y:165-390).
// Clustered around Bay Area, LA basin, Central Valley for visual realism.
export const CA_CONTRACT_POINTS: ContractPoint[] = [
  // Bay Area cluster
  { id: "ca-01", x: 95, y: 270, value: 4.2, hasUCC: true },
  { id: "ca-02", x: 102, y: 258, value: 2.8, hasUCC: true },
  { id: "ca-03", x: 88, y: 278, value: 1.5, hasUCC: false },
  { id: "ca-04", x: 108, y: 264, value: 6.1, hasUCC: true },
  // Sacramento
  { id: "ca-05", x: 100, y: 240, value: 3.2, hasUCC: true },
  { id: "ca-06", x: 106, y: 235, value: 1.9, hasUCC: false },
  // Central Valley
  { id: "ca-07", x: 105, y: 295, value: 2.1, hasUCC: true },
  { id: "ca-08", x: 112, y: 310, value: 3.5, hasUCC: true },
  { id: "ca-09", x: 108, y: 325, value: 1.2, hasUCC: true },
  // LA basin
  { id: "ca-10", x: 120, y: 355, value: 8.4, hasUCC: true },
  { id: "ca-11", x: 128, y: 348, value: 5.7, hasUCC: true },
  { id: "ca-12", x: 115, y: 360, value: 3.1, hasUCC: false },
  { id: "ca-13", x: 132, y: 355, value: 4.8, hasUCC: true },
  { id: "ca-14", x: 125, y: 342, value: 2.3, hasUCC: true },
  // San Diego
  { id: "ca-15", x: 130, y: 375, value: 3.9, hasUCC: true },
  { id: "ca-16", x: 136, y: 370, value: 1.8, hasUCC: false },
  // Inland Empire
  { id: "ca-17", x: 140, y: 358, value: 2.6, hasUCC: true },
  { id: "ca-18", x: 145, y: 352, value: 4.1, hasUCC: false },
  // Fresno
  { id: "ca-19", x: 110, y: 315, value: 1.4, hasUCC: true },
  { id: "ca-20", x: 104, y: 305, value: 2.2, hasUCC: false },
];

export const UCC_MATCH_RATE = "68%";
export const UCC_MATCH_COUNT = CA_CONTRACT_POINTS.filter((p) => p.hasUCC).length;

export const MASKED_FIELDS: MaskedField[] = [
  { label: "Entity Type", value: "Government Contractor — Prime" },
  { label: "Sector", value: "Construction / Heavy Civil" },
  { label: "State", value: "California" },
  { label: "Active Awards", value: "3 prime contracts ($6.2M total)" },
  { label: "UCC Filings", value: "2 active liens — equipment + LOC" },
  { label: "Target Facility", value: "$12.5M asset-backed revolver" },
];
