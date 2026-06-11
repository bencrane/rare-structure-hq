/**
 * Active Operators site content. All copy lives here so sections stay
 * presentational. Strings are stored in natural reading case; sections apply
 * `uppercase` where the design calls for caps.
 */

/** Threat tier — drives the left status rail color on each feed row. */
export type Severity = "critical" | "elevated" | "standard";

export interface FeedEvent {
  id: string;
  title: string;
  agency: string;
  location: string;
  severity: Severity;
  ageSeconds: number;
}

export type FeedTemplate = Omit<FeedEvent, "id" | "ageSeconds">;

/** Initial enforcement-intercept rows (matches the hero feed at load). */
export const feedSeed: FeedEvent[] = [
  {
    id: "seed-1",
    title: "Surface Equipment Impoundment",
    agency: "MSHA District 4",
    location: "Beckley, WV",
    severity: "standard",
    ageSeconds: 0,
  },
  {
    id: "seed-2",
    title: "Surety Bond Revocation",
    agency: "SBA Region 4",
    location: "Atlanta, GA",
    severity: "elevated",
    ageSeconds: 60,
  },
  {
    id: "seed-3",
    title: "Surface Equipment Impoundment",
    agency: "MSHA District 4",
    location: "Beckley, WV",
    severity: "standard",
    ageSeconds: 300,
  },
  {
    id: "seed-4",
    title: "Subterranean Closure Action",
    agency: "MSHA District 8",
    location: "Vincennes, IN",
    severity: "critical",
    ageSeconds: 780,
  },
  {
    id: "seed-5",
    title: "Critical Hazard Citation",
    agency: "OSHA Region 2",
    location: "Newark, NJ",
    severity: "critical",
    ageSeconds: 1740,
  },
];

/** Pool the live feed draws from to synthesize new intercepts over time. */
export const feedPool: FeedTemplate[] = [
  {
    title: "Surface Equipment Impoundment",
    agency: "MSHA District 4",
    location: "Beckley, WV",
    severity: "standard",
  },
  {
    title: "Subterranean Closure Action",
    agency: "MSHA District 8",
    location: "Vincennes, IN",
    severity: "critical",
  },
  {
    title: "Surety Bond Revocation",
    agency: "SBA Region 4",
    location: "Atlanta, GA",
    severity: "elevated",
  },
  {
    title: "Critical Hazard Citation",
    agency: "OSHA Region 2",
    location: "Newark, NJ",
    severity: "critical",
  },
  {
    title: "Stop-Work Order Issued",
    agency: "OSHA Region 3",
    location: "Pittsburgh, PA",
    severity: "critical",
  },
  {
    title: "Clean Water Act Violation",
    agency: "EPA Region 5",
    location: "Gary, IN",
    severity: "elevated",
  },
  {
    title: "Prime Contract Default Notice",
    agency: "USACE",
    location: "New Orleans, LA",
    severity: "elevated",
  },
  {
    title: "Surety Credit Constraint",
    agency: "SBA Region 6",
    location: "Dallas, TX",
    severity: "elevated",
  },
  {
    title: "Imminent Danger Order",
    agency: "MSHA District 2",
    location: "Charleston, WV",
    severity: "critical",
  },
  {
    title: "Remediation Mandate Issued",
    agency: "EPA Region 2",
    location: "Newark, NJ",
    severity: "standard",
  },
];

export interface HeroStat {
  value: string;
  label: string;
}

export const heroStats: HeroStat[] = [
  { value: "156", label: "Files Detected Today" },
  { value: "$3.2B", label: "Capital At Risk" },
  { value: "12", label: "Operators Deployed" },
];

export interface ProtocolPillar {
  num: string;
  title: string;
  body: string;
}

export const networkArchitecture: ProtocolPillar[] = [
  {
    num: "01",
    title: "Structural Allocation",
    body: "The network operates on non-discretionary, pre-vetted routing. When a federal trigger is detected, the exact regional asset assigned to that geographic and sector block is activated. No bidding. No delays.",
  },
  {
    num: "02",
    title: "Specialized Providers",
    body: "A precise syndicate of specialized infrastructure, service, legal, and capital providers explicitly supporting the federal and commercial contracting markets.",
  },
  {
    num: "03",
    title: "Execution Velocity",
    body: "Network partners operate under mandatory, time-sensitive response protocols ensuring immediate mobilization upon target allocation.",
  },
];

export interface Precedent {
  code: string;
  duration: string;
  title: string;
  district: string;
  body: string;
}

export const precedents: Precedent[] = [
  {
    code: "MSHA-D8-992",
    duration: "48 Hours",
    title: "Subterranean Closure Action Neutralized",
    district: "MSHA District 8",
    body: "Federal inspectors issued an immediate closure order halting all subterranean extraction. Active Operators deployed a specialized remediation crew alongside dedicated legal counsel to abate the hazard, satisfy inspector demands, and reopen the site.",
  },
  {
    code: "SBA-R4-104",
    duration: "72 Hours",
    title: "Surety Bond Revocation Blocked",
    district: "SBA Region 4",
    body: "A mid-market contractor faced imminent bond revocation leading to cascading project defaults. We routed $2.5M in immediate bridge liquidity and replaced the surety backing to stabilize operations.",
  },
  {
    code: "USACE-LA-405",
    duration: "14 Days",
    title: "Prime Contract Default Remediation",
    district: "USACE LA District",
    body: "Critical infrastructure project facing termination for default due to equipment mobilization failure. Active Operators stepped in to source, transport, and deploy 15 pieces of heavy machinery to rescue the timeline.",
  },
];

export interface CoverageVector {
  vector: string;
  baseline: string;
  resolution: string;
}

export const coverageVectors: CoverageVector[] = [
  {
    vector: "Regulatory / MSHA",
    baseline: "Subterranean/surface enforcement actions, immediate closure orders.",
    resolution: "Hazard neutralization & operational clearance.",
  },
  {
    vector: "Regulatory / EPA",
    baseline: "Environmental remediation mandates, Clean Water/Air Act violations.",
    resolution: "Containment, abatement & regulatory defense.",
  },
  {
    vector: "Compliance / OSHA",
    baseline: "Critical hazard abatement directives, Stop-Work orders.",
    resolution: "Site-level safety retrofits & compliance routing.",
  },
  {
    vector: "Capital / Contracting",
    baseline: "Maturity cliffs, surety credit constraint, prime contract performance defaults.",
    resolution: "Liquidity routing, surety credit deployment & asset transfer.",
  },
];

export const vectorOptions: string[] = [
  "Regulatory / MSHA",
  "Regulatory / EPA",
  "Compliance / OSHA",
  "Capital / Contracting",
  "Other / Unclassified",
];

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export const footerColumns: FooterColumn[] = [
  {
    heading: "Infrastructure",
    links: [
      { label: "Remediation Protocol", href: "#operating-protocol" },
      { label: "Capital Routing", href: "#coverage-vectors" },
      { label: "Surety Defense", href: "#operational-precedent" },
      { label: "Secure Portal Login", href: "#deployment-protocol" },
    ],
  },
  {
    heading: "Compliance Ops",
    links: [
      { label: "MSHA District 4-8", href: "#coverage-vectors" },
      { label: "OSHA Region 3-6", href: "#coverage-vectors" },
      { label: "EPA Region 2-5", href: "#coverage-vectors" },
      { label: "USACE LA District", href: "#coverage-vectors" },
    ],
  },
];
