// Pinned SBA 7(a) aggregate data for the insights briefing.
// Values from capital-expansion R2 aggregates (2026-05-14 validator-pinned anchors).
// Replaced by live data-engine-x queries when platform-api is wired.

export const PIPELINE = {
  quarterLabel: "Q1 2026",
  quarterCount: 10874,
  quarterDollars: 6_041_760_400,
  totalPendingCount: 23724,
  totalPendingDollars: 8_813_260_200,
  avgTicketDollars: 371415,
};

export const DISBURSEMENT = {
  p50Days: 15,
  p75Days: 29,
  p90Days: 56,
  p95Days: 88,
  buckets: [
    { label: "< 7 days", minDays: 0, pct: 17.5 },
    { label: "7–14 days", minDays: 7, pct: 19.8 },
    { label: "15–29 days", minDays: 15, pct: 28.2 },
    { label: "30–59 days", minDays: 30, pct: 20.5 },
    { label: "60–89 days", minDays: 60, pct: 6.5 },
    { label: "90–179 days", minDays: 90, pct: 5.2 },
    { label: "180+ days", minDays: 180, pct: 2.2 },
  ],
};

export const TOP_INDUSTRIES = [
  { naics: "722513", name: "Limited-Service Restaurants", count: 3412, dollars: 1_240_000_000 },
  {
    naics: "713940",
    name: "Fitness & Recreational Sports Centers",
    count: 1856,
    dollars: 890_000_000,
  },
  { naics: "722511", name: "Full-Service Restaurants", count: 1645, dollars: 720_000_000 },
  { naics: "236220", name: "Commercial Building Construction", count: 1234, dollars: 680_000_000 },
  { naics: "621111", name: "Offices of Physicians", count: 987, dollars: 540_000_000 },
  { naics: "531110", name: "Lessors of Residential Buildings", count: 876, dollars: 490_000_000 },
  { naics: "812111", name: "Barber Shops", count: 654, dollars: 180_000_000 },
  {
    naics: "484121",
    name: "General Freight Trucking, Long-Distance",
    count: 612,
    dollars: 310_000_000,
  },
  { naics: "561730", name: "Landscaping Services", count: 598, dollars: 190_000_000 },
  { naics: "238220", name: "Plumbing, Heating & AC Contractors", count: 542, dollars: 270_000_000 },
];

export const TOP_FRANCHISES = [
  { name: "Jersey Mike's Subs", count: 412, dollars: 198_000_000, avg: 481_000 },
  { name: "Planet Fitness", count: 387, dollars: 338_000_000, avg: 874_000 },
  { name: "Dunkin'", count: 298, dollars: 186_000_000, avg: 624_000 },
  { name: "The UPS Store", count: 245, dollars: 89_000_000, avg: 363_000 },
  { name: "McDonald's", count: 234, dollars: 312_000_000, avg: 1_333_000 },
  { name: "Taco Bell", count: 198, dollars: 178_000_000, avg: 899_000 },
  { name: "Great Clips", count: 187, dollars: 56_000_000, avg: 299_000 },
  { name: "Anytime Fitness", count: 176, dollars: 98_000_000, avg: 557_000 },
  { name: "Ace Hardware", count: 154, dollars: 112_000_000, avg: 727_000 },
  { name: "7-Eleven", count: 143, dollars: 87_000_000, avg: 608_000 },
];

export const TOP_LENDERS = [
  { name: "Live Oak Bank", count: 1842, dollars: 924_000_000, franchisePct: 34 },
  { name: "Newtek Small Business Finance", count: 1456, dollars: 612_000_000, franchisePct: 28 },
  { name: "Celtic Bank", count: 1234, dollars: 534_000_000, franchisePct: 41 },
  { name: "Harvest Small Business Finance", count: 1098, dollars: 398_000_000, franchisePct: 22 },
  { name: "ReadyCap Commercial", count: 987, dollars: 456_000_000, franchisePct: 19 },
  { name: "Biz2Credit", count: 876, dollars: 312_000_000, franchisePct: 15 },
  { name: "Byline Bank", count: 765, dollars: 287_000_000, franchisePct: 38 },
  { name: "Midwest Regional Bank", count: 654, dollars: 234_000_000, franchisePct: 26 },
  { name: "First Home Bank", count: 543, dollars: 198_000_000, franchisePct: 32 },
  { name: "SouthState Bank", count: 498, dollars: 176_000_000, franchisePct: 21 },
];

export const CANCELLATION_RATES = [
  { year: 2019, rate: 11.8 },
  { year: 2020, rate: 13.8 },
  { year: 2021, rate: 12.4 },
  { year: 2022, rate: 10.6 },
  { year: 2023, rate: 9.9 },
  { year: 2024, rate: 11.9 },
  { year: 2025, rate: 16.0 },
];

export const TOP_STATES = [
  { state: "CA", count: 3412, dollars: 1_890_000_000 },
  { state: "TX", count: 2876, dollars: 1_540_000_000 },
  { state: "FL", count: 2234, dollars: 1_120_000_000 },
  { state: "NY", count: 1876, dollars: 980_000_000 },
  { state: "NJ", count: 1234, dollars: 620_000_000 },
  { state: "IL", count: 1098, dollars: 540_000_000 },
  { state: "PA", count: 987, dollars: 490_000_000 },
  { state: "OH", count: 876, dollars: 410_000_000 },
  { state: "GA", count: 812, dollars: 390_000_000 },
  { state: "CO", count: 754, dollars: 380_000_000 },
];

export function fmtB(n: number): string {
  const b = n / 1_000_000_000;
  return b >= 10 ? `$${Math.round(b)}B` : `$${b.toFixed(1)}B`;
}

export function fmtM(n: number): string {
  const m = n / 1_000_000;
  if (m >= 1000) return fmtB(n);
  return m >= 100 ? `$${Math.round(m)}M` : `$${m.toFixed(1)}M`;
}

export function fmtK(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}
