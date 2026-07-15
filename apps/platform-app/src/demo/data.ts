/**
 * Data module for the Rare Structure cockpit — the single data seam.
 *
 * NOW LIVE. The selectors (`runQuery`, `aggregateBy`, `companyById`) fetch the
 * platform-api BFF's WARM federal snapshot (charts + the `entity_profile_gold` map/list
 * slice, precomputed in core-x and served in-memory — no Lance/DuckDB on the request
 * path). They map the wire shape onto the cockpit's `Company` / `AggregateBar` contract,
 * so the rendering layer is unchanged. This module remains the only place in
 * `src/demo/**` that reaches data.
 *
 * The `SEEDS` fixtures below are retained ONLY as the canonical example of the `Company`
 * shape (and its UCC/BDC catalyst variants) — they are no longer rendered. A plotted
 * point is a `Company`; its "Capital Catalysts" are the structural signals on its profile
 * (the live path emits the federal-award catalyst; UCC/BDC remain seed-shape references).
 */

import type { FederalEntity } from "@rare-structure-hq/shared";
import { startDossierPrefetch } from "./dossierCache";
import {
  type WorkbenchFeature,
  fetchAgencyChart,
  fetchEntities,
  fetchEntityByUei,
  fetchIndustryChart,
  fetchPhrase,
  fetchStateChart,
} from "./federalApi";
import { fmtMonthYear, fmtUsd, fmtUsdFull } from "./format";
import { type PhraseResponse, bindingLabel } from "./phrase";
import { projectLonLat } from "./projection";
import type {
  AggregateBar,
  CapitalCatalyst,
  CatalystFact,
  Command,
  Company,
  Industry,
  IndustryKey,
  MapQuery,
} from "./types";

// The headline firehose number — shown in the terminal header.
export const TRACKED_ENTITIES = 4_120_000;

// Reference "today" for award-recency derivation. Fixed: the cockpit runs on a
// frozen fixture — data staleness is a non-issue by design.
const TODAY = new Date("2026-05-21");
const ACTIVE_WINDOW_DAYS = 90;

// ───────────────────────────────────────────────────────────────────
// Industries — the query verticals.
// ───────────────────────────────────────────────────────────────────

export const INDUSTRIES: Industry[] = [
  { key: "heavy_construction", label: "Heavy Construction", naicsPrefix: "237" },
  { key: "energy_infrastructure", label: "Energy Infrastructure", naicsPrefix: "221" },
  { key: "industrial_manufacturing", label: "Industrial Manufacturing", naicsPrefix: "333" },
  { key: "defense_aerospace", label: "Defense & Aerospace", naicsPrefix: "336" },
  { key: "it_services", label: "IT & Professional Services", naicsPrefix: "541" },
  { key: "healthcare_life_sciences", label: "Healthcare & Life Sciences", naicsPrefix: "621" },
  { key: "transportation_logistics", label: "Transportation & Logistics", naicsPrefix: "484" },
];

const INDUSTRY_BY_KEY: Record<IndustryKey, Industry> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.key, i]),
) as Record<IndustryKey, Industry>;

export function industryLabel(key: IndustryKey | undefined): string {
  return key ? (INDUSTRY_BY_KEY[key]?.label ?? key) : "All industries";
}

/**
 * The result banner's primary cell — the axis the query actually ran on.
 *
 * The legacy canned-industry path resolves to the cockpit "Vertical" + its label. The NL `/ask`
 * path resolves to "Scope" + the compiler's interpreted title (falling back to the raw sentence
 * until it resolves), because an NL sentence can filter on ANY axis — vertical, recompete, PSC,
 * capability — not just a vertical. Labeling those "Vertical" (and rendering the
 * `industryLabel(undefined)` → "All industries" placeholder) contradicts the filter that ran.
 */
export function resultScopeCell(
  query: MapQuery | null | undefined,
  interpretedTitle?: string | null,
  /** false (default) → the plain-English query; true → the raw compiled plan
   * (the disclosure surface). The header's scope toggle drives this. */
  showRaw = false,
): { label: string; value: string } {
  const nl = query?.nl?.trim();
  if (nl) {
    const raw = interpretedTitle?.trim();
    return { label: "Scope", value: showRaw ? raw || nl : nl };
  }
  return { label: "Vertical", value: industryLabel(query?.industry) };
}

/** Whether the scope cell has a distinct raw plan to toggle TO — only nl queries
 * whose compiled plan differs from the sentence. Non-nl (vertical) has no raw form. */
export function scopeIsToggleable(
  query: MapQuery | null | undefined,
  interpretedTitle?: string | null,
): boolean {
  const nl = query?.nl?.trim();
  const raw = interpretedTitle?.trim();
  return !!nl && !!raw && raw !== nl;
}

// ───────────────────────────────────────────────────────────────────
// Company seeds — the compact authored data. `buildCompany` expands each
// into a full `Company`, deriving award-recency and assembling the
// Capital Catalysts. `x`/`y` are pixel coords in the us-geo 1000x590 viewBox.
// ───────────────────────────────────────────────────────────────────

type UccSeed = {
  lender: string;
  filed: string;
  collateral: string;
  estAmount: number;
  lienCount: number;
};

type BdcSeed = {
  lender: string;
  facility: string;
  loanSize: number;
  maturity: string;
};

type CompanySeed = {
  id: string;
  name: string;
  industry: IndustryKey;
  naics: string;
  naicsLabel: string;
  city: string;
  state: string;
  x: number;
  y: number;
  founded: number;
  employees: string;
  totalAwarded: number;
  contractCount: number;
  latestAwardDate: string;
  topAgency: string;
  signatureAward: string;
  ucc?: UccSeed;
  bdc?: BdcSeed;
};

const SEEDS: CompanySeed[] = [
  // ── Heavy Construction ────────────────────────────────────────────
  {
    id: "GRC4XK29M7PT",
    name: "Granite Ridge Constructors",
    industry: "heavy_construction",
    naics: "237310",
    naicsLabel: "Highway, Street & Bridge Construction",
    city: "Denver",
    state: "CO",
    x: 370,
    y: 285,
    founded: 1986,
    employees: "900–2,500",
    totalAwarded: 184_000_000,
    contractCount: 47,
    latestAwardDate: "2026-04-08",
    topAgency: "U.S. Army Corps of Engineers",
    signatureAward: "Multi-year USACE highway & bridge rehabilitation IDIQ",
    ucc: {
      lender: "Caterpillar Financial Services",
      filed: "2025-09-12",
      collateral: "Heavy equipment fleet",
      estAmount: 28_000_000,
      lienCount: 3,
    },
  },
  {
    id: "CSC8MT41QW2R",
    name: "Cascade Civil Group",
    industry: "heavy_construction",
    naics: "237990",
    naicsLabel: "Other Heavy & Civil Engineering Construction",
    city: "Seattle",
    state: "WA",
    x: 172,
    y: 78,
    founded: 1994,
    employees: "400–900",
    totalAwarded: 96_500_000,
    contractCount: 31,
    latestAwardDate: "2026-03-02",
    topAgency: "Department of Transportation",
    signatureAward: "Cascadia corridor seismic-retrofit program",
  },
  {
    id: "LSI2QW73KX9N",
    name: "Lone Star Infrastructure",
    industry: "heavy_construction",
    naics: "237310",
    naicsLabel: "Highway, Street & Bridge Construction",
    city: "Houston",
    state: "TX",
    x: 560,
    y: 478,
    founded: 1978,
    employees: "2,500–6,000",
    totalAwarded: 312_000_000,
    contractCount: 58,
    latestAwardDate: "2026-05-04",
    topAgency: "U.S. Army Corps of Engineers",
    signatureAward: "Gulf Coast levee & flood-control reconstruction",
    ucc: {
      lender: "Banc of America Leasing",
      filed: "2025-11-20",
      collateral: "All business assets (blanket lien)",
      estAmount: 65_000_000,
      lienCount: 5,
    },
    bdc: {
      lender: "Ares Capital",
      facility: "Senior secured term loan",
      loanSize: 90_000_000,
      maturity: "2027-03-15",
    },
  },
  {
    id: "KEW6RT82PL3M",
    name: "Keystone Earthworks",
    industry: "heavy_construction",
    naics: "237110",
    naicsLabel: "Water & Sewer Line Construction",
    city: "Pittsburgh",
    state: "PA",
    x: 788,
    y: 247,
    founded: 2001,
    employees: "150–400",
    totalAwarded: 41_200_000,
    contractCount: 22,
    latestAwardDate: "2025-12-15",
    topAgency: "Environmental Protection Agency",
    signatureAward: "Allegheny watershed sewer-line replacement",
  },
  {
    id: "TMC9KX52NW8Q",
    name: "Tidewater Marine Construction",
    industry: "heavy_construction",
    naics: "237990",
    naicsLabel: "Other Heavy & Civil Engineering Construction",
    city: "Jacksonville",
    state: "FL",
    x: 805,
    y: 470,
    founded: 2009,
    employees: "50–150",
    totalAwarded: 7_800_000,
    contractCount: 9,
    latestAwardDate: "2025-08-30",
    topAgency: "Department of the Navy",
    signatureAward: "Naval Station pier & bulkhead repair",
  },
  {
    id: "SLB3MW64RT7K",
    name: "Summit Line Builders",
    industry: "heavy_construction",
    naics: "237130",
    naicsLabel: "Power & Communication Line Construction",
    city: "Salt Lake City",
    state: "UT",
    x: 270,
    y: 255,
    founded: 1991,
    employees: "400–900",
    totalAwarded: 58_400_000,
    contractCount: 26,
    latestAwardDate: "2026-03-28",
    topAgency: "Department of Energy",
    signatureAward: "Western Area Power transmission build-out",
    bdc: {
      lender: "Golub Capital BDC",
      facility: "Unitranche facility",
      loanSize: 42_000_000,
      maturity: "2026-11-30",
    },
  },
  // ── Energy Infrastructure ─────────────────────────────────────────
  {
    id: "MGP7KT38XW2L",
    name: "Meridian Grid Partners",
    industry: "energy_infrastructure",
    naics: "237130",
    naicsLabel: "Power & Communication Line Construction",
    city: "Phoenix",
    state: "AZ",
    x: 245,
    y: 400,
    founded: 1988,
    employees: "900–2,500",
    totalAwarded: 142_000_000,
    contractCount: 34,
    latestAwardDate: "2026-04-22",
    topAgency: "Department of Energy",
    signatureAward: "Desert Southwest grid-hardening program",
    ucc: {
      lender: "Wells Fargo Equipment Finance",
      filed: "2025-10-04",
      collateral: "Plant machinery & equipment",
      estAmount: 38_000_000,
      lienCount: 4,
    },
  },
  {
    id: "BVE5RT91MK6P",
    name: "Blue Vault Energy",
    industry: "energy_infrastructure",
    naics: "221115",
    naicsLabel: "Wind Electric Power Generation",
    city: "Denver",
    state: "CO",
    x: 378,
    y: 292,
    founded: 2007,
    employees: "150–400",
    totalAwarded: 88_000_000,
    contractCount: 19,
    latestAwardDate: "2026-02-26",
    topAgency: "Department of Energy",
    signatureAward: "High Plains wind generation & interconnect",
  },
  {
    id: "GSP2MW84KX7R",
    name: "Gulf Stream Power Systems",
    industry: "energy_infrastructure",
    naics: "221112",
    naicsLabel: "Fossil Fuel Electric Power Generation",
    city: "New Orleans",
    state: "LA",
    x: 615,
    y: 475,
    founded: 1972,
    employees: "400–900",
    totalAwarded: 47_500_000,
    contractCount: 14,
    latestAwardDate: "2025-11-08",
    topAgency: "Department of Energy",
    signatureAward: "Gulf generation-fleet reliability upgrades",
    bdc: {
      lender: "FS KKR Capital",
      facility: "Second-lien term loan",
      loanSize: 55_000_000,
      maturity: "2026-09-30",
    },
  },
  {
    id: "SSI8KX27RT4M",
    name: "Sierra Solar Infrastructure",
    industry: "energy_infrastructure",
    naics: "221114",
    naicsLabel: "Solar Electric Power Generation",
    city: "Las Vegas",
    state: "NV",
    x: 195,
    y: 320,
    founded: 2011,
    employees: "400–900",
    totalAwarded: 211_000_000,
    contractCount: 28,
    latestAwardDate: "2026-05-01",
    topAgency: "General Services Administration",
    signatureAward: "Federal-facility utility-scale solar IDIQ",
    ucc: {
      lender: "Key Equipment Finance",
      filed: "2026-01-18",
      collateral: "Specified equipment & inventory",
      estAmount: 72_000_000,
      lienCount: 6,
    },
    bdc: {
      lender: "Blue Owl Credit",
      facility: "Senior secured term loan",
      loanSize: 120_000_000,
      maturity: "2027-06-30",
    },
  },
  {
    id: "IWT4RT63MW9K",
    name: "Ironwood Transmission",
    industry: "energy_infrastructure",
    naics: "237130",
    naicsLabel: "Power & Communication Line Construction",
    city: "Kansas City",
    state: "MO",
    x: 585,
    y: 305,
    founded: 2014,
    employees: "50–150",
    totalAwarded: 19_400_000,
    contractCount: 11,
    latestAwardDate: "2025-10-22",
    topAgency: "Department of Energy",
    signatureAward: "Midcontinent transmission-line construction",
  },
  {
    id: "ACP9MW36KX2T",
    name: "Atlantic Coast Power",
    industry: "energy_infrastructure",
    naics: "221112",
    naicsLabel: "Fossil Fuel Electric Power Generation",
    city: "Richmond",
    state: "VA",
    x: 835,
    y: 295,
    founded: 1969,
    employees: "900–2,500",
    totalAwarded: 64_000_000,
    contractCount: 21,
    latestAwardDate: "2026-03-14",
    topAgency: "Department of the Navy",
    signatureAward: "Naval-installation power-plant modernization",
  },
  // ── Industrial Manufacturing ──────────────────────────────────────
  {
    id: "FFM6KT45RW8X",
    name: "Forge & Field Manufacturing",
    industry: "industrial_manufacturing",
    naics: "333120",
    naicsLabel: "Construction Machinery Manufacturing",
    city: "Detroit",
    state: "MI",
    x: 710,
    y: 205,
    founded: 1963,
    employees: "900–2,500",
    totalAwarded: 78_000_000,
    contractCount: 41,
    latestAwardDate: "2026-04-11",
    topAgency: "Department of Defense",
    signatureAward: "Defense materiel-handling equipment supply",
    ucc: {
      lender: "PNC Equipment Finance",
      filed: "2025-12-02",
      collateral: "Plant machinery & equipment",
      estAmount: 31_000_000,
      lienCount: 4,
    },
  },
  {
    id: "CTW3RT78MK5P",
    name: "Caldwell Turbine Works",
    industry: "industrial_manufacturing",
    naics: "333611",
    naicsLabel: "Turbine & Turbine Generator Set Manufacturing",
    city: "Cincinnati",
    state: "OH",
    x: 725,
    y: 280,
    founded: 1955,
    employees: "2,500–6,000",
    totalAwarded: 134_000_000,
    contractCount: 23,
    latestAwardDate: "2026-02-19",
    topAgency: "Department of Energy",
    signatureAward: "Power-generation turbine overhaul program",
    bdc: {
      lender: "Owl Rock Capital",
      facility: "Senior secured term loan",
      loanSize: 80_000_000,
      maturity: "2027-01-31",
    },
  },
  {
    id: "ASS8MW52KX6R",
    name: "Anvil Structural Steel",
    industry: "industrial_manufacturing",
    naics: "332312",
    naicsLabel: "Fabricated Structural Metal Manufacturing",
    city: "Birmingham",
    state: "AL",
    x: 685,
    y: 410,
    founded: 1981,
    employees: "400–900",
    totalAwarded: 22_600_000,
    contractCount: 30,
    latestAwardDate: "2026-03-20",
    topAgency: "U.S. Army Corps of Engineers",
    signatureAward: "Fabricated structural steel for federal projects",
    ucc: {
      lender: "Regions Equipment Finance",
      filed: "2025-07-29",
      collateral: "Accounts receivable & inventory",
      estAmount: 12_000_000,
      lienCount: 2,
    },
  },
  {
    id: "PTS5KT29RW3M",
    name: "Precision Tooling Systems",
    industry: "industrial_manufacturing",
    naics: "333517",
    naicsLabel: "Machine Tool Manufacturing",
    city: "Columbus",
    state: "OH",
    x: 745,
    y: 255,
    founded: 1998,
    employees: "150–400",
    totalAwarded: 9_100_000,
    contractCount: 17,
    latestAwardDate: "2026-01-09",
    topAgency: "Department of Defense",
    signatureAward: "Precision machine-tooling for depot maintenance",
  },
  {
    id: "NHE7RT64MX8K",
    name: "Northstar Heavy Equipment",
    industry: "industrial_manufacturing",
    naics: "333120",
    naicsLabel: "Construction Machinery Manufacturing",
    city: "Minneapolis",
    state: "MN",
    x: 590,
    y: 175,
    founded: 2013,
    employees: "50–150",
    totalAwarded: 3_400_000,
    contractCount: 8,
    latestAwardDate: "2025-09-17",
    topAgency: "Department of Agriculture",
    signatureAward: "Forest-service heavy-equipment supply",
  },
  {
    id: "RFB2MW87KT4R",
    name: "Republic Fabrication",
    industry: "industrial_manufacturing",
    naics: "332312",
    naicsLabel: "Fabricated Structural Metal Manufacturing",
    city: "St. Louis",
    state: "MO",
    x: 625,
    y: 320,
    founded: 1976,
    employees: "400–900",
    totalAwarded: 41_800_000,
    contractCount: 26,
    latestAwardDate: "2026-04-30",
    topAgency: "Department of the Army",
    signatureAward: "Modular structural fabrication for Army depots",
    bdc: {
      lender: "Prospect Capital",
      facility: "Unitranche facility",
      loanSize: 35_000_000,
      maturity: "2026-12-31",
    },
  },
  // ── Defense & Aerospace ───────────────────────────────────────────
  {
    id: "ADS9KX73MW6T",
    name: "Atlantic Defense Systems",
    industry: "defense_aerospace",
    naics: "541330",
    naicsLabel: "Engineering Services",
    city: "Washington",
    state: "DC",
    x: 835,
    y: 272,
    founded: 1984,
    employees: "2,500–6,000",
    totalAwarded: 268_000_000,
    contractCount: 52,
    latestAwardDate: "2026-05-06",
    topAgency: "Department of Defense",
    signatureAward: "Defense systems-engineering & integration IDIQ",
  },
  {
    id: "MAE4RT86KX2P",
    name: "Meridian Aerospace",
    industry: "defense_aerospace",
    naics: "336411",
    naicsLabel: "Aircraft Manufacturing",
    city: "Los Angeles",
    state: "CA",
    x: 140,
    y: 350,
    founded: 1961,
    employees: "6,000+",
    totalAwarded: 540_000_000,
    contractCount: 38,
    latestAwardDate: "2026-04-17",
    topAgency: "U.S. Air Force",
    signatureAward: "Airframe sustainment & modification program",
    bdc: {
      lender: "Sixth Street Specialty Lending",
      facility: "Senior secured term loan",
      loanSize: 160_000_000,
      maturity: "2027-09-30",
    },
  },
  {
    id: "VMU6MW48RT9K",
    name: "Vanguard Munitions",
    industry: "defense_aerospace",
    naics: "332993",
    naicsLabel: "Ammunition Manufacturing",
    city: "Oklahoma City",
    state: "OK",
    x: 520,
    y: 360,
    founded: 1979,
    employees: "900–2,500",
    totalAwarded: 121_000_000,
    contractCount: 29,
    latestAwardDate: "2026-03-09",
    topAgency: "Department of the Army",
    signatureAward: "Small- & medium-caliber ammunition production",
    ucc: {
      lender: "U.S. Bank Equipment Finance",
      filed: "2025-08-14",
      collateral: "Plant machinery & equipment",
      estAmount: 44_000_000,
      lienCount: 3,
    },
  },
  {
    id: "SSG8KT35MX7R",
    name: "Sentinel Systems Group",
    industry: "defense_aerospace",
    naics: "336414",
    naicsLabel: "Guided Missile & Space Vehicle Manufacturing",
    city: "Huntsville",
    state: "AL",
    x: 680,
    y: 393,
    founded: 1990,
    employees: "2,500–6,000",
    totalAwarded: 333_000_000,
    contractCount: 44,
    latestAwardDate: "2026-04-25",
    topAgency: "Department of Defense",
    signatureAward: "Missile-defense subsystem development & test",
  },
  {
    id: "TTV3RW92KM5P",
    name: "Talon Tactical Vehicles",
    industry: "defense_aerospace",
    naics: "336992",
    naicsLabel: "Military Armored Vehicle Manufacturing",
    city: "San Antonio",
    state: "TX",
    x: 510,
    y: 480,
    founded: 2004,
    employees: "400–900",
    totalAwarded: 36_000_000,
    contractCount: 19,
    latestAwardDate: "2025-12-03",
    topAgency: "Department of the Army",
    signatureAward: "Tactical-wheeled-vehicle upfit & sustainment",
  },
  {
    id: "CBA7MX64RT8K",
    name: "Cobalt Avionics",
    industry: "defense_aerospace",
    naics: "334511",
    naicsLabel: "Navigation & Aerospace Instrument Manufacturing",
    city: "San Diego",
    state: "CA",
    x: 155,
    y: 385,
    founded: 1995,
    employees: "900–2,500",
    totalAwarded: 87_000_000,
    contractCount: 24,
    latestAwardDate: "2026-02-28",
    topAgency: "Department of the Navy",
    signatureAward: "Naval-aviation navigation & sensor avionics",
  },
  // ── IT & Professional Services ────────────────────────────────────
  {
    id: "BFS5KT82MW3R",
    name: "Beacon Federal Systems",
    industry: "it_services",
    naics: "541512",
    naicsLabel: "Computer Systems Design Services",
    city: "Washington",
    state: "DC",
    x: 840,
    y: 268,
    founded: 1999,
    employees: "2,500–6,000",
    totalAwarded: 196_000_000,
    contractCount: 61,
    latestAwardDate: "2026-05-09",
    topAgency: "Department of Homeland Security",
    signatureAward: "DHS enterprise systems-modernization IDIQ",
  },
  {
    id: "CDG8RW47KX2M",
    name: "Cipher Data Group",
    industry: "it_services",
    naics: "518210",
    naicsLabel: "Data Processing, Hosting & Related Services",
    city: "Reston",
    state: "VA",
    x: 825,
    y: 278,
    founded: 2006,
    employees: "900–2,500",
    totalAwarded: 92_000_000,
    contractCount: 33,
    latestAwardDate: "2026-03-31",
    topAgency: "Department of Defense",
    signatureAward: "Secure cloud hosting for defense workloads",
    ucc: {
      lender: "First-Citizens Bank",
      filed: "2025-10-27",
      collateral: "All business assets (blanket lien)",
      estAmount: 26_000_000,
      lienCount: 2,
    },
  },
  {
    id: "NSL2MX78RT6K",
    name: "Northgate Software Labs",
    industry: "it_services",
    naics: "541511",
    naicsLabel: "Custom Computer Programming Services",
    city: "Austin",
    state: "TX",
    x: 520,
    y: 460,
    founded: 2010,
    employees: "400–900",
    totalAwarded: 44_500_000,
    contractCount: 27,
    latestAwardDate: "2026-04-02",
    topAgency: "General Services Administration",
    signatureAward: "Federal civilian-agency application development",
    bdc: {
      lender: "Golub Capital BDC",
      facility: "Unitranche facility",
      loanSize: 30_000_000,
      maturity: "2026-10-31",
    },
  },
  {
    id: "QAN6KT93MW4R",
    name: "Quorum Analytics",
    industry: "it_services",
    naics: "541512",
    naicsLabel: "Computer Systems Design Services",
    city: "Boston",
    state: "MA",
    x: 905,
    y: 175,
    founded: 2008,
    employees: "400–900",
    totalAwarded: 71_000_000,
    contractCount: 22,
    latestAwardDate: "2026-03-18",
    topAgency: "Department of Health & Human Services",
    signatureAward: "Health-agency data-analytics platform delivery",
  },
  {
    id: "LCS9RW54KX7M",
    name: "Lattice Cloud Services",
    industry: "it_services",
    naics: "518210",
    naicsLabel: "Data Processing, Hosting & Related Services",
    city: "Denver",
    state: "CO",
    x: 362,
    y: 280,
    founded: 2015,
    employees: "150–400",
    totalAwarded: 8_200_000,
    contractCount: 12,
    latestAwardDate: "2025-11-26",
    topAgency: "General Services Administration",
    signatureAward: "FedRAMP-authorized hosting for civilian agencies",
  },
  {
    id: "HCS4MX26RT9K",
    name: "Helix Cyber Solutions",
    industry: "it_services",
    naics: "541519",
    naicsLabel: "Other Computer Related Services",
    city: "Charlotte",
    state: "NC",
    x: 790,
    y: 350,
    founded: 2012,
    employees: "150–400",
    totalAwarded: 31_000_000,
    contractCount: 18,
    latestAwardDate: "2026-04-14",
    topAgency: "Department of Homeland Security",
    signatureAward: "Cyber threat-monitoring & incident response",
    ucc: {
      lender: "PNC Equipment Finance",
      filed: "2026-01-05",
      collateral: "Accounts receivable & inventory",
      estAmount: 9_000_000,
      lienCount: 2,
    },
  },
  // ── Healthcare & Life Sciences ────────────────────────────────────
  {
    id: "HBL7KT63MW8X",
    name: "Halford Biologics",
    industry: "healthcare_life_sciences",
    naics: "541714",
    naicsLabel: "Biotechnology Research & Development",
    city: "San Diego",
    state: "CA",
    x: 160,
    y: 388,
    founded: 2003,
    employees: "400–900",
    totalAwarded: 158_000_000,
    contractCount: 19,
    latestAwardDate: "2026-04-20",
    topAgency: "Department of Health & Human Services",
    signatureAward: "BARDA medical-countermeasure development",
    bdc: {
      lender: "Ares Capital",
      facility: "Senior secured term loan",
      loanSize: 75_000_000,
      maturity: "2027-04-30",
    },
  },
  {
    id: "CMS3RW85KX6T",
    name: "Cardinal Medical Supply",
    industry: "healthcare_life_sciences",
    naics: "339112",
    naicsLabel: "Surgical & Medical Instrument Manufacturing",
    city: "Memphis",
    state: "TN",
    x: 650,
    y: 365,
    founded: 1987,
    employees: "900–2,500",
    totalAwarded: 64_000_000,
    contractCount: 35,
    latestAwardDate: "2026-03-25",
    topAgency: "Department of Veterans Affairs",
    signatureAward: "VA medical-instrument supply schedule",
    ucc: {
      lender: "Wells Fargo Equipment Finance",
      filed: "2025-09-30",
      collateral: "Inventory & equipment",
      estAmount: 18_000_000,
      lienCount: 3,
    },
  },
  {
    id: "SPS8MX42RT5K",
    name: "Summit Pharma Solutions",
    industry: "healthcare_life_sciences",
    naics: "325412",
    naicsLabel: "Pharmaceutical Preparation Manufacturing",
    city: "Philadelphia",
    state: "PA",
    x: 855,
    y: 238,
    founded: 1971,
    employees: "2,500–6,000",
    totalAwarded: 224_000_000,
    contractCount: 28,
    latestAwardDate: "2026-05-02",
    topAgency: "Department of Health & Human Services",
    signatureAward: "Strategic National Stockpile pharmaceutical supply",
    ucc: {
      lender: "Banc of America Leasing",
      filed: "2025-12-19",
      collateral: "All business assets (blanket lien)",
      estAmount: 58_000_000,
      lienCount: 4,
    },
    bdc: {
      lender: "Blue Owl Credit",
      facility: "Second-lien term loan",
      loanSize: 110_000_000,
      maturity: "2026-08-31",
    },
  },
  {
    id: "ECG5KT74MW2R",
    name: "Evergreen Clinical Group",
    industry: "healthcare_life_sciences",
    naics: "621111",
    naicsLabel: "Offices of Physicians",
    city: "Portland",
    state: "OR",
    x: 135,
    y: 122,
    founded: 1996,
    employees: "900–2,500",
    totalAwarded: 12_400_000,
    contractCount: 41,
    latestAwardDate: "2026-02-23",
    topAgency: "Department of Veterans Affairs",
    signatureAward: "VA community-care clinical-services contract",
  },
  {
    id: "ADG2RW63KX9M",
    name: "Atlas Diagnostics",
    industry: "healthcare_life_sciences",
    naics: "339112",
    naicsLabel: "Surgical & Medical Instrument Manufacturing",
    city: "Tampa",
    state: "FL",
    x: 790,
    y: 520,
    founded: 2016,
    employees: "50–150",
    totalAwarded: 4_100_000,
    contractCount: 14,
    latestAwardDate: "2025-10-11",
    topAgency: "Department of Veterans Affairs",
    signatureAward: "Point-of-care diagnostic-device supply",
  },
  {
    id: "RHS9MX38RT4K",
    name: "Riverside Health Systems",
    industry: "healthcare_life_sciences",
    naics: "621111",
    naicsLabel: "Offices of Physicians",
    city: "Nashville",
    state: "TN",
    x: 685,
    y: 360,
    founded: 1984,
    employees: "2,500–6,000",
    totalAwarded: 38_000_000,
    contractCount: 52,
    latestAwardDate: "2026-04-06",
    topAgency: "Department of Veterans Affairs",
    signatureAward: "VA regional clinical-staffing services",
  },
  // ── Transportation & Logistics ────────────────────────────────────
  {
    id: "CFL6KT57MW8R",
    name: "Crossroads Freight Lines",
    industry: "transportation_logistics",
    naics: "484121",
    naicsLabel: "General Freight Trucking, Long-Distance",
    city: "Chicago",
    state: "IL",
    x: 660,
    y: 235,
    founded: 1982,
    employees: "900–2,500",
    totalAwarded: 73_000_000,
    contractCount: 44,
    latestAwardDate: "2026-04-13",
    topAgency: "Department of Defense",
    signatureAward: "Defense Transportation System freight hauling",
    ucc: {
      lender: "Caterpillar Financial Services",
      filed: "2025-11-11",
      collateral: "Rolling stock & trailers",
      estAmount: 22_000_000,
      lienCount: 4,
    },
  },
  {
    id: "PCS3RW86KX5M",
    name: "Pacific Cargo Systems",
    industry: "transportation_logistics",
    naics: "488510",
    naicsLabel: "Freight Transportation Arrangement",
    city: "Long Beach",
    state: "CA",
    x: 140,
    y: 358,
    founded: 1993,
    employees: "400–900",
    totalAwarded: 118_000_000,
    contractCount: 31,
    latestAwardDate: "2026-03-07",
    topAgency: "Department of Defense",
    signatureAward: "Port-to-installation freight forwarding",
    bdc: {
      lender: "FS KKR Capital",
      facility: "Senior secured term loan",
      loanSize: 60_000_000,
      maturity: "2027-02-28",
    },
  },
  {
    id: "HLG8MX24RT7K",
    name: "Heartland Logistics Group",
    industry: "transportation_logistics",
    naics: "493110",
    naicsLabel: "General Warehousing & Storage",
    city: "Kansas City",
    state: "MO",
    x: 588,
    y: 308,
    founded: 2000,
    employees: "400–900",
    totalAwarded: 52_000_000,
    contractCount: 26,
    latestAwardDate: "2026-04-28",
    topAgency: "Defense Logistics Agency",
    signatureAward: "Defense Logistics Agency distribution warehousing",
    ucc: {
      lender: "Key Equipment Finance",
      filed: "2026-02-02",
      collateral: "Equipment & inventory",
      estAmount: 14_000_000,
      lienCount: 2,
    },
  },
  {
    id: "EAF5KT72MW9R",
    name: "Eagle Air Freight",
    industry: "transportation_logistics",
    naics: "481112",
    naicsLabel: "Scheduled Freight Air Transportation",
    city: "Memphis",
    state: "TN",
    x: 652,
    y: 372,
    founded: 1990,
    employees: "900–2,500",
    totalAwarded: 167_000_000,
    contractCount: 22,
    latestAwardDate: "2026-05-08",
    topAgency: "Department of Defense",
    signatureAward: "Air Mobility Command charter airlift",
  },
  {
    id: "CDP2RW93KX6M",
    name: "Coastal Drayage Partners",
    industry: "transportation_logistics",
    naics: "488320",
    naicsLabel: "Marine Cargo Handling",
    city: "Savannah",
    state: "GA",
    x: 765,
    y: 448,
    founded: 2011,
    employees: "50–150",
    totalAwarded: 9_600_000,
    contractCount: 13,
    latestAwardDate: "2025-12-29",
    topAgency: "Department of the Navy",
    signatureAward: "Military Ocean Terminal cargo handling",
  },
  {
    id: "CTS7MX35RT8K",
    name: "Continental Transport Services",
    industry: "transportation_logistics",
    naics: "484121",
    naicsLabel: "General Freight Trucking, Long-Distance",
    city: "Dallas",
    state: "TX",
    x: 522,
    y: 425,
    founded: 1997,
    employees: "400–900",
    totalAwarded: 29_000_000,
    contractCount: 33,
    latestAwardDate: "2026-03-12",
    topAgency: "Department of Defense",
    signatureAward: "Surface-freight movement for defense logistics",
    bdc: {
      lender: "Prospect Capital",
      facility: "Revolving credit facility",
      loanSize: 25_000_000,
      maturity: "2026-12-15",
    },
  },
];

// ───────────────────────────────────────────────────────────────────
// Catalyst assembly — each seed expands to a Company with its Capital
// Catalysts. `usaspending` is always first; `ucc_debt` / `bdc_maturity`
// follow when the seed carries them.
// ───────────────────────────────────────────────────────────────────

function isActive(latestAwardDate: string): boolean {
  const d = new Date(latestAwardDate);
  const ageDays = (TODAY.getTime() - d.getTime()) / 86_400_000;
  return ageDays <= ACTIVE_WINDOW_DAYS;
}

function usaspendingCatalyst(seed: CompanySeed, activeAward: boolean): CapitalCatalyst {
  return {
    kind: "usaspending",
    label: "Federal contract winner",
    headline: seed.signatureAward,
    summary: `${fmtUsd(seed.totalAwarded)} obligated across ${seed.contractCount} prime federal awards. ${activeAward ? "Award activity in the last 90 days." : `Most recent action ${fmtMonthYear(seed.latestAwardDate)}.`}`,
    facts: [
      { label: "Total federal obligations", value: fmtUsdFull(seed.totalAwarded) },
      { label: "Prime awards", value: String(seed.contractCount) },
      { label: "Top awarding agency", value: seed.topAgency },
      {
        label: "Award recency",
        value: activeAward ? "Active — last 90 days" : fmtMonthYear(seed.latestAwardDate),
      },
    ],
    tone: "accent",
  };
}

function uccCatalyst(ucc: UccSeed): CapitalCatalyst {
  return {
    kind: "ucc_debt",
    label: "UCC-1 secured debt",
    headline: `Active secured lien held by ${ucc.lender}`,
    summary: `A UCC-1 financing statement secures ${ucc.collateral.toLowerCase()} — an equipment or working-capital facility filed against the company's assets.`,
    facts: [
      { label: "Secured party", value: ucc.lender },
      { label: "Collateral", value: ucc.collateral },
      { label: "Est. facility size", value: fmtUsd(ucc.estAmount) },
      { label: "Active UCC filings", value: String(ucc.lienCount) },
    ],
    tone: "warn",
  };
}

function bdcCatalyst(bdc: BdcSeed): CapitalCatalyst {
  return {
    kind: "bdc_maturity",
    label: "BDC loan — maturity window",
    headline: `${bdc.facility} matures ${fmtMonthYear(bdc.maturity)}`,
    summary: `A business-development-company loan from ${bdc.lender} approaches maturity — a refinancing or recapitalization window opens ahead of the maturity date.`,
    facts: [
      { label: "BDC lender", value: bdc.lender },
      { label: "Facility", value: bdc.facility },
      { label: "Loan size", value: fmtUsd(bdc.loanSize) },
      { label: "Maturity", value: fmtMonthYear(bdc.maturity) },
    ],
    tone: "info",
  };
}

function buildCompany(seed: CompanySeed): Company {
  const activeAward = isActive(seed.latestAwardDate);
  const catalysts: CapitalCatalyst[] = [usaspendingCatalyst(seed, activeAward)];
  if (seed.ucc) catalysts.push(uccCatalyst(seed.ucc));
  if (seed.bdc) catalysts.push(bdcCatalyst(seed.bdc));
  return {
    id: seed.id,
    name: seed.name,
    industry: seed.industry,
    naics: seed.naics,
    naicsLabel: seed.naicsLabel,
    city: seed.city,
    state: seed.state,
    x: seed.x,
    y: seed.y,
    founded: seed.founded,
    employees: seed.employees,
    totalAwarded: seed.totalAwarded,
    contractCount: seed.contractCount,
    latestAwardDate: seed.latestAwardDate,
    topAgency: seed.topAgency,
    activeAward,
    catalysts,
  };
}

// ───────────────────────────────────────────────────────────────────
// LIVE selectors — the cockpit's universe is now the BFF's warm federal
// snapshot (entity_profile_gold slice), not the SEEDS fixtures. The seed
// machinery above (SEEDS / buildCompany / the UCC+BDC catalysts) is retained
// only as the shape reference for the `Company` contract; nothing renders it.
// `runQuery` / `aggregateBy` / `companyById` below fetch live data and map it
// onto the SAME `Company` / `AggregateBar` shapes the rendering layer expects.
// ───────────────────────────────────────────────────────────────────

// Silence "unused" without shipping the fixtures: the seeds remain the canonical
// example of the Company shape, referenced here so the build keeps them honest.
void SEEDS;
void buildCompany;

/** NAICS 6-digit code (or prefix) → the cockpit vertical it belongs to, by 3-digit
 * prefix. Live entities carry a raw NAICS; this resolves the display vertical when one
 * of the cockpit's seven verticals matches (else the vertical is left undefined). */
function industryForNaics(naics: string | null | undefined): IndustryKey | undefined {
  if (!naics) return undefined;
  const p3 = naics.slice(0, 3);
  const hit = INDUSTRIES.find((i) => i.naicsPrefix === p3);
  return hit?.key;
}

/** Build the single live `usaspending` Capital Catalyst from a federal entity's
 * obligation rollup (the live profile drawer's content). */
function liveCatalyst(e: FederalEntity): CapitalCatalyst {
  const active = e.totalActiveObligations > 0;
  return {
    kind: "usaspending",
    label: "Federal contract winner",
    headline: `${fmtUsd(e.totalLifetimeObligations)} in lifetime federal obligations`,
    summary: `${fmtUsd(e.totalLifetimeObligations)} obligated lifetime${
      active ? `, ${fmtUsd(e.totalActiveObligations)} still active` : ""
    } across ${e.activeAwardCount} active award${e.activeAwardCount === 1 ? "" : "s"}.`,
    facts: [
      { label: "Lifetime federal obligations", value: fmtUsdFull(e.totalLifetimeObligations) },
      { label: "Active obligations", value: fmtUsdFull(e.totalActiveObligations) },
      { label: "Active awards", value: String(e.activeAwardCount) },
      { label: "Primary NAICS", value: e.naics ?? "—" },
    ],
    tone: "accent",
  };
}

/** Map a live `FederalEntity` onto the cockpit's `Company` shape. The entity's real lat/lon
 * (from the serving snapshot's geocode join) is projected through the recovered Albers-USA
 * composite (see ./projection) onto the us-geo 1000x590 viewBox and set on `x`/`y`, lighting
 * up the dot layer. Entities with no geocode hit (null lat/lon, or a point off the US
 * composite) simply carry no x/y and the map omits their dot. */
function entityToCompany(e: FederalEntity): Company {
  const geo = e.lat != null && e.lon != null ? projectLonLat(e.lon, e.lat) : null;
  return {
    id: e.uei,
    name: e.legalNameBase ?? e.uei,
    industry: industryForNaics(e.naics),
    naics: e.naics ?? "",
    city: e.city ?? undefined,
    state: e.state ?? undefined,
    totalAwarded: e.totalLifetimeObligations,
    activeAwarded: e.totalActiveObligations,
    contractCount: e.activeAwardCount,
    activeAward: e.totalActiveObligations > 0,
    ...(geo ? { x: geo.x, y: geo.y } : {}),
    catalysts: [liveCatalyst(e)],
  };
}

// ── Deterministic phrase path (catalyst phrase compiler → market rows → Company) ───
// A free-typed sentence routes through the CLOSED-grammar phrase compiler — zero
// LLM anywhere on the path: every token binds to a disclosed filter or the whole
// phrase REFUSES with a 422 naming the token (surfaced verbatim in the banner —
// refusals teach the vocabulary). The legacy edge_api /ask (forced-tool Anthropic
// call) is DISABLED: every map answer now has a replayable plan (meta.bindings +
// meta.plan), so a surprising result is always explainable.

function rowStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function rowNum(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** The obligation-money column per market grain (the subject decides what $ means). */
const GRAIN_MONEY_KEY: Record<string, string> = {
  entity: "prime_obl_lifetime",
  prime_award: "life_to_date_obligated",
  transaction: "federal_action_obligation",
};

/** The `usaspending` Capital Catalyst for a market row's obligation rollup. */
function marketCatalyst(
  totalAwarded: number,
  contractCount: number,
  naics: string,
  hasFed: boolean,
): CapitalCatalyst {
  return {
    kind: "usaspending",
    label: "Federal contract winner",
    headline: `${fmtUsd(totalAwarded)} in federal obligations`,
    summary: `${fmtUsd(totalAwarded)} obligated across ${contractCount} federal award${
      contractCount === 1 ? "" : "s"
    }.${hasFed ? " Holds active federal awards." : ""}`,
    facts: [
      { label: "Federal obligations", value: fmtUsdFull(totalAwarded) },
      { label: "Awards", value: String(contractCount) },
      { label: "Primary NAICS", value: naics || "—" },
      { label: "Federal awards", value: hasFed ? "Active" : "—" },
    ],
    tone: "accent",
  };
}

/** Market entity-grain row (entities.v6 wire columns + geo hydration) → Company. */
function marketEntityRowToCompany(r: Record<string, unknown>): Company {
  const naics = rowStr(r.top_naics) ?? "";
  const totalAwarded = rowNum(r.prime_obl_lifetime);
  const active = r.is_prime_24mo === true;
  const lat = r.latitude;
  const lon = r.longitude;
  const geo = typeof lat === "number" && typeof lon === "number" ? projectLonLat(lon, lat) : null;
  const id = rowStr(r.uei) ?? "";
  return {
    id,
    name: rowStr(r.legal_business_name) ?? id,
    industry: industryForNaics(naics),
    naics,
    state: rowStr(r.physical_state),
    totalAwarded,
    activeAwarded: totalAwarded,
    latestAwardDate: rowStr(r.last_action_date),
    activeAward: active,
    ...(geo ? { x: geo.x, y: geo.y } : {}),
    catalysts: [marketCatalyst(totalAwarded, 0, naics, active)],
  };
}

/**
 * Market TABLE-grain rows (prime_award / transaction) → one Company per recipient.
 * Award/action rows repeat a recipient, so the map reads COMPANIES: money sums over
 * the group, the count rides `contractCount`, the coords borrow from any geocoded
 * row (award rows hydrate recipient-HQ geo; transaction rows carry no geometry —
 * those companies simply plot nothing, disclosed by the plotted count).
 */
function marketTableRowsToCompanies(grain: string, rows: Record<string, unknown>[]): Company[] {
  const moneyKey = GRAIN_MONEY_KEY[grain] ?? "life_to_date_obligated";
  const byRecipient = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const key = rowStr(r.recipient_uei) ?? rowStr(r.recipient_name) ?? "unknown";
    const g = byRecipient.get(key);
    if (g) g.push(r);
    else byRecipient.set(key, [r]);
  }
  const out: Company[] = [];
  for (const group of byRecipient.values()) {
    const rep = group.reduce((a, b) => (rowNum(b[moneyKey]) > rowNum(a[moneyKey]) ? b : a));
    const sum = group.reduce((acc, r) => acc + rowNum(r[moneyKey]), 0);
    const latest = group.reduce<string | undefined>((acc, r) => {
      const d = rowStr(r.last_action_date) ?? rowStr(r.action_date);
      return d && (!acc || d > acc) ? d : acc;
    }, undefined);
    const geocoded = group.find(
      (r) => typeof r.latitude === "number" && typeof r.longitude === "number",
    );
    const geo = geocoded
      ? projectLonLat(geocoded.longitude as number, geocoded.latitude as number)
      : null;
    const naics = rowStr(rep.naics_code) ?? "";
    const id = rowStr(rep.recipient_uei) ?? rowStr(rep.recipient_name) ?? "unknown";
    out.push({
      id,
      name: rowStr(rep.recipient_name) ?? id,
      industry: industryForNaics(naics),
      naics,
      totalAwarded: sum,
      contractCount: group.length,
      latestAwardDate: latest,
      activeAward: sum > 0,
      ...(geo ? { x: geo.x, y: geo.y } : {}),
      catalysts: [marketCatalyst(sum, group.length, naics, sum > 0)],
    });
  }
  return out.sort((a, b) => b.totalAwarded - a.totalAwarded);
}

/** The full-disclosure scope line: every non-connective binding, joined. */
function phraseScopeTitle(res: PhraseResponse): string {
  const parts = res.meta.bindings.map(bindingLabel).filter(Boolean);
  return `${res.meta.grain} · ${parts.join(" · ")}`;
}

/** Compiled-phrase response → the cockpit's QueryResult (companies + provenance). */
export function phraseToQueryResult(res: PhraseResponse): QueryResult {
  const rows = res.data.rows ?? [];
  const companies =
    res.meta.grain === "entity"
      ? rows.map(marketEntityRowToCompany)
      : marketTableRowsToCompanies(res.meta.grain ?? "", rows);
  startDossierPrefetch(companies.map((c) => c.id));
  return {
    companies,
    total: companies.length,
    minLifetimeBound: 0,
    fullUniverse: res.meta.total ?? rows.length,
    materializedAt: "",
    profileAsOfDate: null,
    interpretedTitle: phraseScopeTitle(res),
  };
}

/** Run a free-typed sentence through the deterministic phrase compiler. A refusal
 * (422, token named) THROWS with catalyst's detail verbatim — the map banner is the
 * teaching surface, never a silent fallback. */
export async function runPhrase(phrase: string): Promise<QueryResult> {
  return phraseToQueryResult(await fetchPhrase(phrase));
}

/**
 * Workbench result → the same QueryResult the map renders ("Plot on map").
 * Features are the market adapter's GeoJSON: `properties` carry the wire row,
 * `geometry` the real Point (null for non-plottable rows / the transactions grain).
 */
export function workbenchResultToQueryResult(
  dataset: string,
  features: WorkbenchFeature[],
  title: string,
): QueryResult {
  const grain =
    dataset === "entities" ? "entity" : dataset === "prime_awards" ? "prime_award" : "transaction";
  const rows = features.map((f) => {
    const p: Record<string, unknown> = { ...(f.properties ?? {}) };
    const g = f.geometry as { coordinates?: unknown } | null;
    const c = g?.coordinates;
    if (Array.isArray(c) && c.length === 2 && p.latitude == null) {
      p.longitude = c[0];
      p.latitude = c[1];
    }
    return p;
  });
  const companies =
    grain === "entity"
      ? rows.map(marketEntityRowToCompany)
      : marketTableRowsToCompanies(grain, rows);
  startDossierPrefetch(companies.map((c) => c.id));
  return {
    companies,
    total: companies.length,
    minLifetimeBound: 0,
    fullUniverse: rows.length,
    materializedAt: "",
    profileAsOfDate: null,
    interpretedTitle: title,
  };
}

// ───────────────────────────────────────────────────────────────────
// The ⌘K command list — the cockpit is extended by adding to this array.
// ───────────────────────────────────────────────────────────────────

export const COMMANDS: Command[] = [
  // ── Canned PHRASES — every sentence below compiles on the CLOSED grammar (they
  // are acceptance fixtures of catalyst's phrase compiler). An edited sentence
  // that drifts off-vocabulary REFUSES with the token named — that refusal is the
  // signal to be more precise or to expand the vocabulary (a reviewed PR), never
  // a fuzzy guess. The legacy /ask NL compiler is disabled. ──
  {
    id: "p-code-a-construction",
    kind: "map-query",
    label: "Construction companies that received a code A mod in the last 90 days",
    query: {
      nl: "construction companies that received a code A mod in the last 90 days",
      minAward: 0,
    },
  },
  {
    id: "p-terminated-default",
    kind: "map-query",
    label: "Companies terminated for default in the last year",
    query: { nl: "companies terminated for default in the last year", minAward: 0 },
  },
  {
    id: "p-option-exercised",
    kind: "map-query",
    label: "IT services companies whose option was exercised in the last quarter",
    query: {
      nl: "it services companies whose option was exercised in the last quarter",
      minAward: 0,
    },
  },
  {
    id: "p-novated",
    kind: "map-query",
    label: "Companies novated in the last 2 years",
    query: { nl: "companies novated in the last 2 years", minAward: 0 },
  },
  {
    id: "p-subk-plan-added",
    kind: "map-query",
    label: "Companies that received a code Y mod on construction awards in the last year",
    query: {
      nl: "companies that received a code Y mod on construction awards in the last year",
      minAward: 0,
    },
  },
  {
    id: "p-expiring-construction",
    kind: "map-query",
    label: "Construction companies with awards expiring within 90 days",
    query: { nl: "construction companies with awards expiring within 90 days", minAward: 0 },
  },
  {
    id: "p-two-lane-runway-expiry",
    kind: "map-query",
    label: "Construction companies: option exercised recently + awards expiring within 180 days",
    query: {
      nl: "construction companies with awards expiring within 180 days that received a code G mod in the last 90 days",
      minAward: 0,
    },
  },
  {
    id: "p-active-dsbs-va",
    kind: "map-query",
    label: "Active DSBS companies in VA",
    query: { nl: "active dsbs companies in VA", minAward: 0 },
  },
  {
    id: "agg-industry",
    kind: "aggregate",
    label: "Aggregate federal contract spend by industry",
    aggregate: {
      groupBy: "industry",
      title: "Federal contract spend by industry",
      unitLabel: "Total obligations",
    },
  },
  {
    id: "agg-state",
    kind: "aggregate",
    label: "Aggregate federal contract spend by state",
    aggregate: {
      groupBy: "state",
      title: "Federal contract spend by state",
      unitLabel: "Total obligations",
    },
  },
  {
    id: "agg-agency",
    kind: "aggregate",
    label: "Aggregate federal contract spend by agency",
    aggregate: {
      groupBy: "agency",
      title: "Federal contract spend by agency",
      unitLabel: "Total obligations",
    },
  },
];

// ───────────────────────────────────────────────────────────────────
// LIVE selectors — the cockpit reads the universe only through these. They
// fetch the BFF's warm federal snapshot and map it onto the rendering shapes.
// Each returns a Promise (the universe is remote now); DemoApp drives the
// loading/error states. NO silent caps — the entity query is bounded to a sane
// page and reports the full match `total` for the readout.
// ───────────────────────────────────────────────────────────────────

/** The map-query result + its provenance + the unfiltered match total (for the readout). */
export type QueryResult = {
  companies: Company[];
  total: number;
  /** The serving slice's stated lifetime-obligation bound (firms below it are excluded). */
  minLifetimeBound: number;
  /** Full has-federal-awards universe size. */
  fullUniverse: number;
  materializedAt: string;
  profileAsOfDate: string | null;
  /** Reserved: constraints a compiler could not express. The phrase compiler REFUSES
   * instead of partially applying, so this is always absent on the phrase path. */
  notApplied?: string[];
  /** The phrase compiler's full-disclosure scope line (grain + every binding) — the
   * banner's "Scope" value. Present only on the phrase path. */
  interpretedTitle?: string;
};

// The map plots query results; a generous page covers the densest vertical without a
// silent cap — the full match count rides back in `total` for the banner.
const MAP_PAGE_LIMIT = 2000;

/** Live companies matching a map query — by NAICS (prefix/code) + optional state, above
 * the lifetime-obligation floor. Fetches the BFF entity slice and maps to `Company`. */
export async function runQuery(q: MapQuery): Promise<QueryResult> {
  // Free-typed sentence → the deterministic phrase compiler (a refusal throws verbatim).
  if (q.nl?.trim()) return runPhrase(q.nl.trim());
  const naics =
    q.naicsPrefix ?? (q.industry ? INDUSTRY_BY_KEY[q.industry]?.naicsPrefix : undefined);
  const res = await fetchEntities({
    naics,
    state: q.state,
    minObligation: q.minAward > 0 ? q.minAward : undefined,
    limit: MAP_PAGE_LIMIT,
  });
  const companies = res.rows.map(entityToCompany);
  startDossierPrefetch(companies.map((c) => c.id)); // eager dossier warm (canned path)
  return {
    companies,
    total: res.total,
    minLifetimeBound: res.minLifetimeBound,
    fullUniverse: res.fullUniverse,
    materializedAt: res.materializedAt,
    profileAsOfDate: res.profileAsOfDate,
  };
}

/** Look up one company by UEI — the profile-drawer point lookup (live). */
export async function companyById(id: string): Promise<Company | undefined> {
  try {
    return entityToCompany(await fetchEntityByUei(id));
  } catch {
    return undefined;
  }
}

/** Live aggregate bars for a chart vantage, sorted by total descending. Industry +
 * state + agency each hit their own precomputed BFF chart. */
export async function aggregateBy(
  groupBy: "industry" | "state" | "agency",
): Promise<AggregateBar[]> {
  if (groupBy === "industry") {
    const chart = await fetchIndustryChart();
    return (
      chart.rows
        // Public Administration (NAICS sector 92) is the government itself — intra-
        // government / pass-through obligations (Medicaid admin, etc.), not an addressable
        // contracting opportunity. Its multi-trillion totals also dwarf every real vertical
        // and flatten the bar scale. Drop it so the chart reads as actual opportunity.
        .filter((r) => !(r.naics ?? "").startsWith("92"))
        .map((r) => ({
          key: r.naics ?? "—",
          // Prefer the cockpit vertical label when the NAICS maps to one; else show the code.
          label: (() => {
            const ind = industryForNaics(r.naics);
            return ind ? `${industryLabel(ind)} · ${r.naics}` : (r.naics ?? "—");
          })(),
          total: r.spend_lifetime,
          count: r.firms,
        }))
    );
  }
  if (groupBy === "agency") {
    const chart = await fetchAgencyChart();
    return chart.rows.map((r) => ({
      key: r.agency,
      label: r.agency,
      total: r.spend,
      count: r.recipients,
    }));
  }
  const chart = await fetchStateChart();
  return chart.rows.map((r) => ({
    key: r.state,
    label: r.state,
    total: r.spend_lifetime,
    count: r.firms,
  }));
}
