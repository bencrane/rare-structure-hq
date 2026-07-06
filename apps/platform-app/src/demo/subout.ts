/**
 * Sub-out opportunities — pure types + plotting logic for the per-UEI map layer.
 *
 * The wire is catalyst's `subout_opportunities.v2` recipe, brokered verbatim by the
 * BFF at POST /api/v1/federal/subout-opportunities (15-min response cache upstream).
 * Rows carry the award's place-of-performance centroid (latitude/longitude, honest
 * per pop_geo_precision — null when ungeocoded); meta.target_hq carries the target's
 * HQ point (present even on empty answers). This module owns everything testable
 * without a network: UEI validation, lat/lon → viewBox projection (dropping
 * unplottable rows honestly), score→radius scaling, and lens display labels.
 * The wire call itself lives in `federalApi.ts`.
 */

import { projectLonLat } from "./projection";

/** A 12-char SAM UEI — validated client-side before any fetch fires. */
export const UEI_RE = /^[A-Z0-9]{12}$/i;

export function isValidUei(s: string): boolean {
  return UEI_RE.test(s.trim());
}

// ── Wire types (catalyst subout_opportunities.v2, snake_case pass-through) ────

/** One explicit score component: contribution = weight × normalized raw signal. */
export type SuboutComponent = {
  name: string;
  raw_value: unknown;
  weight: number;
  contribution: number;
};

/** One (lens, code) evidence hit connecting the target to the prime. */
export type SuboutMatched = {
  lens: string;
  code: string;
  evidence: Record<string, unknown>;
};

export type NearestFederalSite = {
  site_name: string | null;
  site_type: string | null;
  site_source: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_mi: number | null;
  lease_expiring_24mo_ct: number | null;
  earliest_lease_expiration_date: string | null;
};

export type SuboutOpportunity = {
  generated_unique_award_id: string | null;
  award_id_piid: string | null;
  prime_uei: string | null;
  prime_name: string | null;
  naics_code: string | null;
  product_or_service_code: string | null;
  awarding_agency_code: string | null;
  awarding_agency_name: string | null;
  total_obligation: number | null;
  base_and_all_options_value: number | null;
  subaward_count: number | null;
  total_subaward_amount: number | null;
  subcontracting_plan_code: string | null;
  award_or_idv_flag: string | null;
  idv_type_code: string | null;
  type_of_set_aside_code: string | null;
  period_of_performance_current_end_date: string | null;
  ordering_period_end_date: string | null;
  pop_state_code: string | null;
  pop_geo_precision: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_mi: number | null;
  nearest_federal_site: NearestFederalSite | null;
  matched: SuboutMatched[];
  score: number;
  components: SuboutComponent[];
};

export type SuboutPeer = {
  uei: string;
  shared_code: string | null;
  legal_business_name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type SuboutMeta = {
  recipeId: string;
  registryVersion: string;
  componentWeights: Record<string, number>;
  uei: string;
  lenses: string[];
  cache_state: string;
  cache_build_ms: number | null;
  target_hq: { latitude: number; longitude: number } | null;
  timings_ms: Record<string, number>;
  total: number;
  reason?: string;
  notes?: string[];
};

export type SuboutResponse = {
  meta: SuboutMeta;
  data: { opportunities: SuboutOpportunity[]; peers: SuboutPeer[] };
};

/** The request body — mirrors catalyst's fail-closed contract (unknown keys 422). */
export type SuboutRequest = {
  uei: string;
  lenses?: string[];
  codes_override?: string[];
  code_type?: "naics" | "psc";
  limit?: number;
  include_peers?: boolean;
};

// ── Plotting (lat/lon → the us-geo 1000x590 viewBox) ──────────────────────────

export type PlottedOpportunity = SuboutOpportunity & { x: number; y: number };

export type SuboutPlot = {
  /** Rows that landed on the canvas — the dot layer. */
  plotted: PlottedOpportunity[];
  /** Rows served without a plottable point (no centroid, or outside the Albers
   * composite) — counted honestly in the console chip, never dotted at a bogus spot. */
  unplotted: SuboutOpportunity[];
  /** The target's HQ pin, when the entity geocodes inside the composite. */
  hq: { x: number; y: number } | null;
};

type Projector = (lon: number, lat: number) => { x: number; y: number } | null;

/**
 * Project the response onto the map. Rows without coordinates (or that
 * geoAlbersUsa cannot place — territories, off-canvas) go to `unplotted`.
 * `project` is injectable for tests; production uses the shared Albers projector.
 */
export function plotSubout(
  opportunities: SuboutOpportunity[],
  targetHq: { latitude: number; longitude: number } | null,
  project: Projector = projectLonLat,
): SuboutPlot {
  const plotted: PlottedOpportunity[] = [];
  const unplotted: SuboutOpportunity[] = [];
  for (const opp of opportunities) {
    const p =
      opp.latitude != null && opp.longitude != null ? project(opp.longitude, opp.latitude) : null;
    if (p) plotted.push({ ...opp, x: p.x, y: p.y });
    else unplotted.push(opp);
  }
  const hq = targetHq ? project(targetHq.longitude, targetHq.latitude) : null;
  return { plotted, unplotted, hq };
}

/**
 * Score → dot radius. Scores are Σ of weighted [0,1] components (weights sum to 1),
 * so the observed range is roughly [0.1, 0.8]; map linearly onto [2, 4.5]px and
 * clamp — a stronger opportunity reads as a visibly heavier dot.
 */
export function scoreRadius(score: number): number {
  const r = 2 + ((score - 0.1) / 0.7) * 2.5;
  return Math.min(4.5, Math.max(2, r));
}

// ── Display vocabulary (the lens names are self-describing but long) ──────────

export const LENS_LABELS: Record<string, string> = {
  awarded_prime_contracts_in_code: "Primed in code",
  delivered_subawards_under_code: "Delivered subs under code",
  sam_registered_naics: "SAM-registered",
  inferred_primeable: "Inferred primeable",
  caller_declared: "Declared",
};

export function lensLabel(lens: string): string {
  return LENS_LABELS[lens] ?? lens;
}

export const COMPONENT_LABELS: Record<string, string> = {
  prime_subout_history: "Prime sub-out history",
  award_already_subbing: "Already subbing",
  subcontracting_plan: "Subcontracting plan",
  lens_strength: "Capability match",
  proximity: "HQ proximity",
  expiring_window: "Expiring window",
  federal_site_proximity: "Federal site nearby",
};

export function componentLabel(name: string): string {
  return COMPONENT_LABELS[name] ?? name;
}
