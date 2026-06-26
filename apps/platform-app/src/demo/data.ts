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
  type AskMarketRow,
  type MarketAggregate,
  askMap,
  fetchAgencyChart,
  fetchEntities,
  fetchEntityByUei,
  fetchIndustryChart,
  fetchStateChart,
} from "./federalApi";
import { fmtMonthYear, fmtUsd, fmtUsdFull } from "./format";
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
  ResolvedAggregate,
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
): { label: string; value: string } {
  const nl = query?.nl?.trim();
  if (nl) return { label: "Scope", value: interpretedTitle?.trim() || nl };
  return { label: "Vertical", value: industryLabel(query?.industry) };
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

// ── Natural-language query path (edge_api /ask → GeoJSON → Company) ──────────
// A free-typed sentence is compiled by edge_api (forced-tool Anthropic call) into a constrained
// filter, executed on catalyst_api over the geocoded serving tables, and returned as GeoJSON.
// Each feature's flattened properties map onto the SAME `Company` shape the canned path emits,
// so the rendering layer is unchanged. The row's real lat/lon is projected through the recovered
// Albers-USA composite (see ./projection) onto the us-geo 1000x590 viewBox and set on `x`/`y`,
// lighting up the dot layer for live geocoded entities.

function askRowStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function askRowNum(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function askRowBool(v: unknown): boolean {
  return v === true || v === "true";
}

function askRowList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length ? out : undefined;
}

/** snake_case controlled-vocab token → human label, e.g. "electrical_systems" → "Electrical systems". */
function humanizeTag(t: string): string {
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The single `usaspending` Capital Catalyst for an /ask row's obligation rollup. */
function askCatalyst(
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

/** PHASE-3 govcon capability Capital Catalyst — the "does X and requires A,B,C" signal rolled
 * onto a prime winner from its awards' extracted solicitation requirements. Structured /
 * controlled-vocab only (no verbatim quotes ever cross the serving boundary). */
function capabilityCatalyst(
  reqClearance: boolean,
  clearanceMax: string | undefined,
  reqCmmc: boolean,
  capabilityTags: string[] | undefined,
  laborCategories: string[] | undefined,
  coveredAwards: number,
): CapitalCatalyst {
  const tags = (capabilityTags ?? []).map(humanizeTag);
  const trades = (laborCategories ?? []).map(humanizeTag);
  const reqs: string[] = [];
  if (clearanceMax) reqs.push(`${clearanceMax.replace(/_/g, " ")} clearance`);
  else if (reqClearance) reqs.push("security clearance");
  if (reqCmmc) reqs.push("CMMC certification");
  const headline = tags.length
    ? `Does ${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " +more" : ""}`
    : "Extracted solicitation scope";
  const reqsText = reqs.length
    ? ` Requires ${reqs.join(" + ")}.`
    : " No clearance/CMMC requirement detected.";
  const summary = `${coveredAwards} award${
    coveredAwards === 1 ? "" : "s"
  } with readable solicitation docs.${reqsText}`;
  const facts: CatalystFact[] = [
    {
      label: "Clearance required",
      value: clearanceMax ? clearanceMax.replace(/_/g, " ") : reqClearance ? "Yes" : "—",
    },
    { label: "CMMC required", value: reqCmmc ? "Yes" : "—" },
    { label: "Capabilities", value: tags.length ? tags.slice(0, 4).join(", ") : "—" },
    { label: "Trades / labor", value: trades.length ? trades.slice(0, 4).join(", ") : "—" },
    { label: "Covered awards", value: String(coveredAwards) },
  ];
  return {
    kind: "govcon_capability",
    label: "Solicitation capability profile",
    headline,
    summary,
    facts,
    tone: reqClearance || reqCmmc ? "warn" : "info",
  };
}

/** Map one flattened edge `/ask` row onto the cockpit's `Company` shape. Handles BOTH the
 * `company` and `winners` serving tables (their property names differ; both are resolved). */
function askRowToCompany(r: AskMarketRow): Company {
  const naics = askRowStr(r.primary_naics) ?? askRowStr(r.naics_code) ?? askRowStr(r.naics2) ?? "";
  const name =
    askRowStr(r.company_name) ??
    askRowStr(r.winner_name) ??
    askRowStr(r.uei) ??
    askRowStr(r.winner_uei) ??
    "Unknown";
  const id = askRowStr(r.uei) ?? askRowStr(r.winner_uei) ?? name;
  // company rows: lifetime active obligations; winners/awards rows: window/action dollars;
  // active (recompete) rows: current_value (the contract's current total value). The active
  // dataset carries none of the first three keys, so without current_value its money read $0.
  const totalAwarded = askRowNum(
    r.total_active_obligations ?? r.entity_obligated_usd ?? r.action_obligated_usd ?? r.current_value,
  );
  const contractCount = askRowNum(r.award_count);
  const hasFed =
    r.has_federal_awards === true ||
    askRowNum(r.entity_obligated_usd) > 0 ||
    askRowNum(r.action_obligated_usd) > 0 ||
    totalAwarded > 0;
  // Project the row's real lat/lon onto the us-geo 1000x590 viewBox so the dot layer can plot it.
  // askRowNum coerces missing to 0, so guard the (0,0) null-island explicitly; projectLonLat
  // returns null off the US composite (PR/GU/etc.) — those rows simply carry no x/y.
  const hasLatLon = r.lat != null && r.lon != null;
  const lat = askRowNum(r.lat);
  const lon = askRowNum(r.lon);
  const geo = hasLatLon && (lat !== 0 || lon !== 0) ? projectLonLat(lon, lat) : null;
  // PHASE-3 capability fields (winners dataset, prime recipients) — absent on company/awards rows.
  const hasExtractedScope = askRowBool(r.has_extracted_scope);
  const requiresClearance = askRowBool(r.requires_clearance);
  const reqClearanceLevelMax = askRowStr(r.req_clearance_level_max);
  const requiresCmmc = askRowBool(r.requires_cmmc);
  const capabilityTags = askRowList(r.capability_tags);
  const laborCategories = askRowList(r.labor_categories);
  const coveredAwardCount = askRowNum(r.covered_award_count);
  const catalysts: CapitalCatalyst[] = [askCatalyst(totalAwarded, contractCount, naics, hasFed)];
  if (hasExtractedScope) {
    catalysts.push(
      capabilityCatalyst(
        requiresClearance,
        reqClearanceLevelMax,
        requiresCmmc,
        capabilityTags,
        laborCategories,
        coveredAwardCount,
      ),
    );
  }
  return {
    id,
    name,
    industry: industryForNaics(naics),
    naics,
    naicsLabel: askRowStr(r.industry),
    city: askRowStr(r.hq_city) ?? askRowStr(r.city),
    state: askRowStr(r.hq_state) ?? askRowStr(r.state),
    totalAwarded,
    activeAwarded: totalAwarded,
    contractCount,
    latestAwardDate: askRowStr(r.action_date) ?? askRowStr(r.last_action_date) ?? undefined,
    activeAward: hasFed,
    ...(geo ? { x: geo.x, y: geo.y } : {}),
    ...(hasExtractedScope
      ? {
          hasExtractedScope,
          requiresClearance,
          reqClearanceLevelMax,
          requiresCmmc,
          capabilityTags,
          laborCategories,
          coveredAwardCount,
        }
      : {}),
    catalysts,
  };
}

/**
 * Collapse same-name legal entities into one row. A holding company often holds several SAM
 * registrations (one UEI per subsidiary), so the raw result lists "Bristol Bay Construction
 * Holdings Llc" three times — which reads as a bug even though each is a distinct UEI. We group
 * by normalized name: `totalAwarded` becomes the group sum, the row keeps the largest single
 * entity's identity (its profile opens on click), and `relatedEntities` records the count.
 */
function dedupeByName(list: Company[]): Company[] {
  const groups = new Map<string, Company[]>();
  for (const c of list) {
    const key = c.name.trim().toLowerCase().replace(/\s+/g, " ");
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  const out: Company[] = [];
  for (const group of groups.values()) {
    const rep = group.reduce((a, b) => (b.totalAwarded > a.totalAwarded ? b : a));
    const sum = group.reduce((s, c) => s + c.totalAwarded, 0);
    out.push({ ...rep, totalAwarded: sum, relatedEntities: group.length });
  }
  return out.sort((a, b) => b.totalAwarded - a.totalAwarded);
}

/**
 * Collapse award-ACTION rows (the `awards` dataset is 1 row per contract action) to ONE row
 * per winner: the demo reads COMPANIES that won qualifying awards, not per-action duplicates.
 * `action_obligated_usd` becomes the winner's QUALIFYING-window sum, `award_count` the number of
 * qualifying actions, `action_date` the most recent one. The representative row is the largest
 * single action; coordinates borrow from any geocoded action so the dot still plots when the
 * top action's address didn't resolve.
 */
function collapseAwardActions(rows: AskMarketRow[]): AskMarketRow[] {
  const byWinner = new Map<string, AskMarketRow[]>();
  for (const r of rows) {
    const key = askRowStr(r.winner_uei) ?? askRowStr(r.winner_name) ?? "unknown";
    const g = byWinner.get(key);
    if (g) g.push(r);
    else byWinner.set(key, [r]);
  }
  const out: AskMarketRow[] = [];
  for (const group of byWinner.values()) {
    const rep = group.reduce((a, b) =>
      askRowNum(b.action_obligated_usd) > askRowNum(a.action_obligated_usd) ? b : a,
    );
    const sum = group.reduce((acc, r) => acc + askRowNum(r.action_obligated_usd), 0);
    const latest = group.reduce<string | undefined>((acc, r) => {
      const d = askRowStr(r.action_date);
      return d && (!acc || d > acc) ? d : acc;
    }, undefined);
    const geocoded = group.find((r) => r.lat != null && r.lon != null);
    out.push({
      ...rep,
      action_obligated_usd: sum,
      award_count: group.length,
      action_date: latest,
      lat: rep.lat ?? geocoded?.lat,
      lon: rep.lon ?? geocoded?.lon,
    });
  }
  return out;
}

// PSC categories the operator queries by name; the leading char is the FPDS PSC "category".
const PSC_CATEGORY_LABEL: Record<string, string> = { V: "Transportation/Travel/Relocation" };

/** A human label for one aggregate group, by grouping dimension. size_band → a $ range from
 * its lo/hi bounds; winner → the entity name; psc_category → the named category; else the raw key. */
function aggregateLabel(groupBy: string, g: MarketAggregate["groups"][number]): string {
  if (groupBy === "size_band") {
    const lo = g.lo ?? null;
    const hi = g.hi ?? null;
    if (lo == null) return `< ${fmtUsd(hi ?? 0)}`;
    if (hi == null) return `> ${fmtUsd(lo)}`;
    return `${fmtUsd(lo)} – ${fmtUsd(hi)}`;
  }
  const key = g.key == null ? "—" : String(g.key);
  if (groupBy === "psc_category" && PSC_CATEGORY_LABEL[key])
    return `${key} · ${PSC_CATEGORY_LABEL[key]}`;
  return key;
}

const AGG_DIM_LABEL: Record<string, string> = {
  awarding_agency: "agency",
  awarding_sub_agency: "sub-agency",
  naics2: "NAICS sector",
  naics_code: "NAICS",
  psc_category: "PSC category",
  psc_code: "PSC",
  state: "winner state",
  pop_state: "place-of-performance state",
  set_aside: "set-aside",
  winner_type: "winner type",
  winner: "top winners",
  size_band: "award size",
  vertical: "vertical",
  work_type: "work type",
  equipment_intensity: "equipment intensity",
};

/** Map the camelCase aggregate envelope → render-ready ResolvedAggregate. The bar value is the
 * summed measure when present (the $ vantage), else the group count (a pure histogram).
 * Exported for unit tests (the label + USD-vs-count mapping is the load-bearing logic). */
export function resolveAggregate(
  agg: MarketAggregate,
  title: string | undefined,
  notApplied: string[],
): ResolvedAggregate {
  const hasSum = agg.groups.some((g) => g.sum != null);
  const bars: AggregateBar[] = agg.groups.map((g, i) => ({
    key: `${g.key ?? i}`,
    label: aggregateLabel(agg.groupBy, g),
    total: hasSum ? (g.sum ?? 0) : g.count,
    count: g.count,
    median: g.median ?? null,
    p90: g.p90 ?? null,
  }));
  const dim = AGG_DIM_LABEL[agg.groupBy] ?? agg.groupBy;
  return {
    title: title?.trim() || `${hasSum ? "Obligated $" : "Award actions"} by ${dim}`,
    groupBy: agg.groupBy,
    unitLabel: hasSum ? "USD obligated" : "award actions",
    matchedRows: agg.matchedRows,
    totalGroups: agg.totalGroups,
    bars,
    notApplied,
  };
}

/** Run a free-typed natural-language market query through edge_api `/ask`. Returns the SAME
 * `QueryResult` shape the canned filter path produces (same-name entities collapsed) — or, when
 * the query asked for a breakdown/total/distribution/ranking, a result carrying an `aggregate`. */
export async function runAsk(
  nl: string,
  dataset: "company" | "winners" | "awards" | "active" | "auto" = "auto",
): Promise<QueryResult> {
  const res = await askMap(nl, dataset);
  // Aggregate intent → a chart, not pins. companies stays empty; the view routes on `aggregate`.
  if (res.aggregate) {
    return {
      companies: [],
      total: res.aggregate.matchedRows,
      minLifetimeBound: 0,
      fullUniverse: res.aggregate.matchedRows,
      materializedAt: "",
      profileAsOfDate: null,
      notApplied: res.unmapped ?? [],
      aggregate: resolveAggregate(res.aggregate, res.query?.title, res.unmapped ?? []),
    };
  }
  const baseRows = res.dataset === "awards" ? collapseAwardActions(res.rows) : res.rows;
  const companies = dedupeByName(baseRows.map(askRowToCompany));
  // Eager dossier prefetch for the ENTIRE result set, in ranked order — fire and
  // forget: the drawer must open warm, and this must never delay the result render.
  startDossierPrefetch(companies.map((c) => c.id));
  return {
    companies,
    // The headline count is distinct companies (post-collapse); the raw UEI match rides in
    // `fullUniverse` for anyone who needs it.
    total: companies.length,
    minLifetimeBound: 0,
    fullUniverse: res.total,
    materializedAt: "",
    profileAsOfDate: null,
    // The honesty contract: constraints the compiler could not express. The banner
    // renders them as "not applied" — the demo never implies a filter it didn't run.
    notApplied: res.unmapped ?? [],
    // The compiler's read of the sentence — the banner's "Scope" value (vs. the misleading
    // "Vertical: All industries" that industryLabel(undefined) yields on the NL path).
    interpretedTitle: res.query?.title?.trim() || undefined,
  };
}

// ───────────────────────────────────────────────────────────────────
// The ⌘K command list — the cockpit is extended by adding to this array.
// ───────────────────────────────────────────────────────────────────

export const COMMANDS: Command[] = [
  // ── Industry VERTICAL axis (live GTM label on the awards serving table — the (NAICS,PSC)
  // pair classified into a 24-name vertical, distinct from the raw naics2 sector). NL routed
  // through /ask so the sentence compiles onto the BITMAP `vertical` column. ──
  {
    id: "q-vertical-aerospace",
    kind: "map-query",
    label: "Aerospace & Defense contracts over $5M",
    query: { nl: "aerospace contracts over $5M", dataset: "awards", minAward: 0 },
  },
  {
    id: "q-vertical-it-software",
    kind: "map-query",
    label: "Information Technology & Software awards over $10M",
    query: { nl: "information technology contracts over $10M", dataset: "awards", minAward: 0 },
  },
  {
    id: "q-vertical-healthcare",
    kind: "map-query",
    label: "Healthcare & Life Sciences awards over $5M",
    query: { nl: "healthcare contracts over $5M", dataset: "awards", minAward: 0 },
  },
  {
    id: "q-vertical-breakdown",
    kind: "map-query",
    label: "Break down award obligations by vertical",
    query: {
      nl: "total award obligations broken down by vertical",
      dataset: "awards",
      minAward: 0,
    },
  },
  {
    id: "q-vertical-top",
    kind: "map-query",
    label: "Top verticals by obligations",
    query: { nl: "top verticals by total obligations", dataset: "awards", minAward: 0 },
  },
  // ── work_type (make-vs-resell) + equipment_intensity (financing signal) — the mobilization-
  // capital axes that AND with the vertical. ──
  {
    id: "q-worktype-manufacturers",
    kind: "map-query",
    label: "Manufacturers that won over $5M",
    query: { nl: "manufacturers that won over $5M", dataset: "awards", minAward: 0 },
  },
  {
    id: "q-equip-heavy",
    kind: "map-query",
    label: "Equipment-heavy awards over $1M",
    query: { nl: "equipment-heavy awards over $1M", dataset: "awards", minAward: 0 },
  },
  // ── PHASE-3 capability queries ("does X and requires A,B,C" — winners dataset) ──
  {
    id: "q-cap-cleared-electrical",
    kind: "map-query",
    label: "Construction winners requiring Secret clearance with cleared electrical trades",
    query: {
      nl: "construction winners requiring secret clearance with electricians",
      dataset: "winners",
      minAward: 0,
    },
  },
  {
    id: "q-cap-cmmc-cyber",
    kind: "map-query",
    label: "Winners that do cybersecurity work and require CMMC certification",
    query: {
      nl: "winners that do cybersecurity work and require CMMC certification",
      dataset: "winners",
      minAward: 0,
    },
  },
  {
    id: "q-cap-cleared-it",
    kind: "map-query",
    label: "IT-services winners requiring a security clearance",
    query: {
      nl: "winners that do IT services and require a security clearance",
      dataset: "winners",
      minAward: 0,
    },
  },
  // ── Recompete radar (forward-looking active-awards dataset) — incumbents about to rebuy ──
  {
    id: "q-recompete-transportation",
    kind: "map-query",
    label: "Transportation contracts up for recompete in the next 180 days",
    query: {
      nl: "transportation contracts expiring in the next 180 days",
      dataset: "active",
      minAward: 0,
    },
  },
  {
    id: "q-recompete-small-business",
    kind: "map-query",
    label: "Small-business contracts expiring in the next 90 days",
    query: {
      nl: "small business contracts expiring in the next 90 days",
      dataset: "active",
      minAward: 0,
    },
  },
  {
    id: "q-recompete-by-agency",
    kind: "map-query",
    label: "Expiring contract value by agency (next 180 days)",
    query: {
      nl: "contracts expiring in the next 180 days broken down by awarding agency",
      dataset: "active",
      minAward: 0,
    },
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
  /** NL-query constraints the compiler could NOT express ("not applied" banner signal).
   * Absent/empty on the canned filter path — every canned constraint always runs. */
  notApplied?: string[];
  /** Present when the NL query was a breakdown/total/distribution/ranking — the cockpit
   * renders AggregateView from this instead of the map/table. Absent for row queries. */
  aggregate?: ResolvedAggregate;
  /** The `/ask` compiler's human-readable interpretation of an NL row query — the banner's
   * "Scope" value. Present only on the NL path; absent on the canned filter path. */
  interpretedTitle?: string;
};

// The map plots query results; a generous page covers the densest vertical without a
// silent cap — the full match count rides back in `total` for the banner.
const MAP_PAGE_LIMIT = 2000;

/** Live companies matching a map query — by NAICS (prefix/code) + optional state, above
 * the lifetime-obligation floor. Fetches the BFF entity slice and maps to `Company`. */
export async function runQuery(q: MapQuery): Promise<QueryResult> {
  // Free-typed NL query → the edge_api /ask compiler; the canned filter axis is bypassed.
  if (q.nl?.trim()) return runAsk(q.nl.trim(), q.dataset ?? "auto");
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
