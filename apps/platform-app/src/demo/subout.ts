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

/** Rule A evidence: the target has received subawards from this award's prime. */
export type MatchedWorkedUnderPrime = {
  rule: "worked_under_prime";
  prime_uei: string;
  subaward_amt_from_prime: number;
  edge_ct: number;
  last_action_date: string | null;
};

/** One shared (agency, code) pair connecting a peer firm to the target. */
export type SharedPair = {
  agency_code: string;
  code_type: string;
  code: string;
  code_title?: string | null;
};

/** Rule B evidence: peers (firms that won prime awards in the target's own
 * (agency, code) pairs) have subbed on this award. */
export type MatchedPeerSubawardee = {
  rule: "peer_subawardee";
  peer_ct: number;
  peers: { uei: string; shared_pairs: SharedPair[] }[];
};

export type MatchedVia = MatchedWorkedUnderPrime | MatchedPeerSubawardee;

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
  matched_via: MatchedVia[];
};

export type SuboutMeta = {
  recipeId: string;
  registryVersion: string;
  uei: string;
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
  data: { opportunities: SuboutOpportunity[] };
};

/** The request body — mirrors catalyst's fail-closed v3 contract ({uei, limit?}
 * ONLY; anything else is a 422). */
export type SuboutRequest = {
  uei: string;
  limit?: number;
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

/** Uniform dot radius — v3 is a FLAT list (no scoring), so every dot reads equal. */
export const OPPORTUNITY_DOT_RADIUS = 3;
