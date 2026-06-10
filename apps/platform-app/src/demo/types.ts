/**
 * Types for the Rare Structure cockpit — the operator-driven market terminal.
 *
 * The cockpit is a free-form instrument: the operator opens ⌘K, runs a
 * command, and the US map (or an aggregate chart) responds. A plotted point
 * is a *company*; clicking it opens that company's profile, where its
 * "Capital Catalysts" — the structural signals attached to it — are shown.
 *
 * These types are the fixture contract. `data.ts` is the single data module;
 * when the platform-api BFF lands it returns this shape and `data.ts` is the
 * swap point — nothing else in `src/demo/**` reads data directly.
 */

/**
 * A muted background dot — pure decoration, conveys the firehose volume of
 * the market. `band` (0-5, west to east) drives the staggered entrance.
 * Geometry is generated in `us-geo.ts`.
 */
export type ScatterDot = {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
  band: number;
};

/** The industry verticals the cockpit can query. */
export type IndustryKey =
  | "heavy_construction"
  | "energy_infrastructure"
  | "industrial_manufacturing"
  | "defense_aerospace"
  | "it_services"
  | "healthcare_life_sciences"
  | "transportation_logistics";

/** An industry vertical — display label + the NAICS family it maps to. */
export type Industry = {
  key: IndustryKey;
  label: string;
  naicsPrefix: string;
};

/**
 * The kind of Capital Catalyst — a structural signal attached to a company.
 * `usaspending` is present on every plotted company (it is the query axis);
 * `ucc_debt` and `bdc_maturity` are present on a subset. New catalyst kinds
 * are added here as the taxonomy grows.
 */
export type CatalystKind = "usaspending" | "ucc_debt" | "bdc_maturity";

/** One labelled fact rendered inside a catalyst card. */
export type CatalystFact = {
  label: string;
  value: string;
};

/** A Capital Catalyst — one structural signal on a company's profile. */
export type CapitalCatalyst = {
  kind: CatalystKind;
  /** Short kind label — "Federal contract winner". */
  label: string;
  /** One-line signal headline. */
  headline: string;
  /** A sentence of context. */
  summary: string;
  /** Structured facts shown in the catalyst card. */
  facts: CatalystFact[];
  /** Visual tone for the card. */
  tone: "accent" | "info" | "warn";
};

/** A company — one plotted point on the map, one profile when clicked.
 *
 * Now backed by LIVE federal data (the BFF's warm `entity_profile_gold` slice). Fields
 * the gold slice does not carry are optional: `x`/`y` (the geographic dot layer's real
 * lat/long is DEFERRED — no coordinate join / geocode this pass), and the seed-only
 * narrative fields (`founded`, `employees`, `naicsLabel`, `topAgency`, `latestAwardDate`,
 * `industry`). The rendering layer treats them as optional and degrades gracefully. */
export type Company = {
  /** SAM.gov UEI — 12-char unique entity identifier (the live resolution key). */
  id: string;
  name: string;
  /** Industry vertical, when the NAICS maps to one of the cockpit's verticals. */
  industry?: IndustryKey;
  naics: string;
  naicsLabel?: string;
  city?: string;
  /** Two-letter state code. */
  state?: string;
  /** Pixel coordinates in the `us-geo` 1000x590 viewBox — ABSENT for live entities
   * until the geographic coordinate layer lands (geo deferred). */
  x?: number;
  y?: number;
  founded?: number;
  /** Employee-count range label, e.g. "200–500". */
  employees?: string;
  /** Total federal obligation, lifetime, USD — the query + aggregate axis. */
  totalAwarded: number;
  /** Active (open) federal obligation, USD. */
  activeAwarded?: number;
  contractCount?: number;
  /** ISO date of the most recent federal award action. */
  latestAwardDate?: string;
  topAgency?: string;
  /** True when the company has open/active federal obligations. */
  activeAward: boolean;
  /** The structural signals attached to this company (usaspending always first). */
  catalysts: CapitalCatalyst[];
};

/**
 * A map query — the widened live axis. Carries the NAICS selector (code or prefix), an
 * optional state, and the lifetime-obligation floor, so richer queries have somewhere to
 * land. `industry` is the cockpit-vertical convenience key (the canned commands set it);
 * `naicsPrefix` is what actually drives the live filter. `minAward` is the obligation
 * floor (kept name-stable for the rendering layer).
 */
export type MapQuery = {
  /** Cockpit vertical, when the query came from a canned industry command. */
  industry?: IndustryKey;
  /** NAICS code or 2–6 digit prefix — the live filter axis. */
  naicsPrefix?: string;
  /** 2-letter US state code. */
  state?: string;
  /** Lifetime-obligation floor, USD. */
  minAward: number;
};

/** An aggregate command — collapses the market into one chart. */
export type AggregateSpec = {
  groupBy: "industry" | "state" | "agency";
  title: string;
  unitLabel: string;
};

/**
 * A ⌘K command. `map-query` lights up the map with companies; `aggregate`
 * swaps the map for a chart. New commands are added to the `COMMANDS` list
 * in `data.ts` — the cockpit is extended by data, not code.
 */
export type Command =
  | {
      id: string;
      kind: "map-query";
      /** Natural-language command text shown in the palette. */
      label: string;
      query: MapQuery;
    }
  | {
      id: string;
      kind: "aggregate";
      label: string;
      aggregate: AggregateSpec;
    };

/** One bar in an aggregate chart. */
export type AggregateBar = {
  key: string;
  label: string;
  total: number;
  count: number;
};
