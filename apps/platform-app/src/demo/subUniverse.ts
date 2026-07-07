/**
 * Sub-universe — pure types + gate evaluation + plotting for the per-UEI
 * eligible-buyer map layer.
 *
 * The wire is catalyst's `sub_universe.v1` recipe, brokered verbatim by the BFF
 * at POST /api/v1/federal/sub-universe: enter a sub's UEI → the buyers whose
 * demonstrated farm-out lanes overlap the sub's demonstrated combos, ordered by
 * matched farm-out $ desc. FACTS-ONLY DOCTRINE: there is no score anywhere.
 * The tunable gates (MVS floor, repeat depth, vehicles, prime-backed, combos,
 * disclosed sub-buyers) never delete a node — a node failing any gate is DIMMED
 * with every failing gate's reason disclosed, and re-evaluation is entirely
 * client-side (no re-fetch on parameter change). UNKNOWN ≠ ZERO: a fact the
 * wire discloses as null (teaming absent from the pair mart, no disclosed
 * chunk medians) NEVER fails a gate — it surfaces as an `unknowns` annotation
 * alongside the reasons. Lane-level gates (MVS, combo overlap, prime-backed)
 * evaluate over `gate_facts` — the FULL matched-lane set — never over the
 * display-capped `matched_via`. This module owns everything testable without
 * a network: response types, gate semantics, lat/lon → viewBox projection
 * (dropping unplottable nodes honestly), and the filter-option builders.
 * The wire call itself lives in `federalApi.ts`.
 */

import { fmtUsd } from "./format";
import { projectLonLat } from "./projection";

// ── Wire types (catalyst sub_universe.v1, snake_case pass-through) ───────────

/** One matched lane: a (NAICS × PSC) combo the buyer farms out that the sub has
 * demonstrated. Capped at 25 per node upstream (see `matched_via_truncated`) —
 * DISPLAY ONLY; gates evaluate over `gate_facts`. Farm-out fields may be null
 * on undisclosed nodes (unknown, not zero); `candidate_prime_obl_60mo` is
 * always carried. */
export type SubUniverseMatchedVia = {
  combo: string;
  naics_code: string | null;
  psc_code: string | null;
  naics_title: string | null;
  psc_title: string | null;
  farmout_amt_60mo: number | null;
  median_chunk_60mo: number | null;
  median_chunk_lifetime: number | null;
  n_subawards_lifetime: number | null;
  n_distinct_subs_60mo: number | null;
  last_action_date: string | null;
  anchor_uei: string | null;
  candidate_prime_obl_60mo: number;
  prime_backed: boolean;
};

/** The buyer's teaming posture — repeat-partner depth over 5y. null = UNKNOWN
 * (the prime is absent from the pair mart) — an unknown NEVER fails a gate. */
export type SubUniverseTeaming = {
  n_sub_partners_5y: number | null;
  deepest_repeat_edges_5y: number | null;
  n_partners_ge_3_edges: number | null;
};

/** One lane's gate-relevant facts: `m` = median chunk 60mo (null = no
 * disclosed median → unknown, never fails MVS); `pb` = prime-backed lane. */
export type SubUniverseGateFact = { m: number | null; pb: boolean };

/** One vehicle (parent PIID) the buyer has disclosed sub $ under. */
export type SubUniverseVehicle = {
  parent_piid: string;
  farmout_amt_60mo: number;
  last_action_date: string | null;
};

/** One buyer node — a prime with matched farm-out lanes. lat/lon may be null.
 * `matched_farmout_60mo` may be null (undisclosed — display "—", not $0).
 * `gate_facts` is the FULL matched-lane set keyed by combo — the ONLY input
 * to the lane-level gates; `matched_via` is the display-capped top 25
 * (`matched_via_truncated` flags the cap). `disclosed_sub_buyer` = false means
 * no FSRS-disclosed sub-buying — the buyer may still buy below the reporting
 * threshold or undisclosed. */
export type SubUniverseNode = {
  uei: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_precision: string | null;
  matched_farmout_60mo: number | null;
  n_matched_combos: number;
  matched_via: SubUniverseMatchedVia[];
  matched_via_truncated: boolean;
  gate_facts: { [combo: string]: SubUniverseGateFact };
  disclosed_sub_buyer: boolean;
  teaming: SubUniverseTeaming;
  vehicles: SubUniverseVehicle[];
};

/** The target block: the sub's own demonstrated posture + the expressed,
 * tunable defaults the console seeds its gates from. */
export type SubUniverseTarget = {
  uei: string;
  anchors: {
    prime_uei: string;
    prime_name: string | null;
    edge_dollars_5y: number;
    edge_count_5y: number;
    last_action_date: string | null;
  }[];
  demonstrated_combos: {
    combo: string;
    naics_code: string | null;
    psc_code: string | null;
    n_edges: number;
    total_usd: number;
    median_chunk_usd: number | null;
    last_action_date: string | null;
  }[];
  pop_states: { state: string; sub_usd: number }[];
  vehicles: { parent_piid: string; sub_usd: number }[];
  prime_combos: {
    combo: string;
    naics_code: string | null;
    psc_code: string | null;
    prime_obl_60mo: number;
  }[];
  defaults: {
    /** null = insufficient history to set a default floor — the MVS input
     * starts EMPTY (gate off) and `mvs_reason` is shown verbatim. */
    mvs_usd: number | null;
    /** How many demonstrated chunks the default floor was derived from. */
    mvs_n: number;
    /** Why there is no default floor (verbatim console copy) — null when set. */
    mvs_reason: string | null;
    repeat_k: number;
    pop_states: string[];
    window: string;
  };
};

export type SubUniverseMeta = {
  recipe: string;
  n_anchors: number;
  n_anchor_combos: number;
  total: number;
  returned: number;
  capped: boolean;
  reason: string | null;
  cache_state: string;
  timings_ms: Record<string, number>;
};

export type SubUniverseResponse = {
  data: SubUniverseNode[];
  target: SubUniverseTarget;
  meta: SubUniverseMeta;
};

/** The request body — {uei, limit?} only (anything else is a 422 upstream). */
export type SubUniverseRequest = {
  uei: string;
  limit?: number;
};

// ── Gate parameters + evaluation (the client-side lit/dim doctrine) ──────────

/** The tunable gates. null (or empty list) = that gate is OFF — every node
 * passes it. Changing these NEVER re-fetches; evaluation is pure. */
export type SubUniverseGateParams = {
  /** Minimum viable subcontract floor (USD) against the best disclosed median chunk. */
  mvsUsd: number | null;
  /** Required repeat-partner depth: deepest_repeat_edges_5y >= K. */
  repeatK: number | null;
  /** Restrict to buyers with disclosed sub $ under these parent PIIDs. */
  vehiclePiids: string[] | null;
  /** Require at least one prime-backed matched lane. */
  primeBackedOnly: boolean;
  /** Restrict to nodes overlapping these combos (also scopes the MVS gate). */
  combos: string[] | null;
  /** Dim buyers without FSRS-disclosed sub-buying (default ON) — toggle off
   * to reveal the full lookalike-winner universe. */
  disclosedSubBuyersOnly: boolean;
};

/** Seed the gates from the target's expressed defaults (MVS + repeat-K);
 * the disclosed-sub-buyers filter starts ON; vehicle/combo filters and
 * prime-backed start off. A null mvs_usd default leaves the MVS gate OFF. */
export function defaultGateParams(target: SubUniverseTarget): SubUniverseGateParams {
  return {
    mvsUsd: target.defaults.mvs_usd,
    repeatK: target.defaults.repeat_k ?? 3,
    vehiclePiids: null,
    primeBackedOnly: false,
    combos: null,
    disclosedSubBuyersOnly: true,
  };
}

export type SubUniverseEvaluation = {
  status: "lit" | "dim";
  /** Every failing gate's disclosed reason — a node failing multiple gates
   * accumulates ALL of them. Empty iff lit. Only a KNOWN fact that fails a
   * gate lands here. */
  reasons: string[];
  /** Unknown-fact disclosures (unknown ≠ zero) — facts the wire could not
   * state, annotated honestly. NEVER cause a dim. */
  unknowns: string[];
};

/**
 * Evaluate one node against the gates. Facts-only: a failing node is DIMMED
 * with reasons, never deleted. A gate fails ONLY on a known fact that fails;
 * an unknown fact (null on the wire) produces an `unknowns` annotation
 * instead. Lane-level gates evaluate over `gate_facts` — the FULL matched-lane
 * set — never over the display-capped `matched_via`. Gate semantics:
 *  - Disclosed sub-buyers: disclosed_sub_buyer must be true (default ON).
 *  - MVS floor: SOME gate_facts lane (scoped to the combo filter when set)
 *    must disclose m >= mvsUsd; when EVERY lane in scope has m = null the
 *    medians are unknown → annotate, never dim.
 *  - Repeat depth: teaming.deepest_repeat_edges_5y >= repeatK; null depth is
 *    unknown → annotate, never dim.
 *  - Vehicles: some node vehicle parent_piid is in the selected list.
 *  - Prime-backed: some gate_facts lane carries pb.
 *  - Combos: some gate_facts combo is in the selected set.
 */
export function evaluateNode(
  node: SubUniverseNode,
  params: SubUniverseGateParams,
): SubUniverseEvaluation {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const comboSet = params.combos && params.combos.length > 0 ? new Set(params.combos) : null;

  // The full matched-lane fact set — scoped to the selected combos when the
  // combo filter is on (the scope the MVS gate evaluates in).
  const allFacts = Object.entries(node.gate_facts);
  const scopedFacts = comboSet ? allFacts.filter(([combo]) => comboSet.has(combo)) : allFacts;

  // Disclosed sub-buyers — a KNOWN false is a truthful dim, not a deletion.
  if (params.disclosedSubBuyersOnly && !node.disclosed_sub_buyer)
    reasons.push("no FSRS-disclosed sub-buying — may buy below reporting threshold or undisclosed");

  // MVS floor — over the FULL lane set, scoped to the selected combos. An
  // empty scope is the combo gate's finding, not an MVS failure.
  if (params.mvsUsd != null && scopedFacts.length > 0) {
    let best: number | null = null;
    for (const [, fact] of scopedFacts) {
      if (fact.m != null && (best == null || fact.m > best)) best = fact.m;
    }
    if (best == null) unknowns.push("chunk medians unknown");
    else if (best < params.mvsUsd)
      reasons.push(`below ${fmtUsd(params.mvsUsd)} floor — best median chunk ${fmtUsd(best)}`);
  }

  // Repeat depth — null = the prime is absent from the pair mart: unknown.
  if (params.repeatK != null) {
    const deepest = node.teaming.deepest_repeat_edges_5y;
    if (deepest == null) unknowns.push("repeat depth unknown");
    else if (deepest < params.repeatK)
      reasons.push(`no sub partner with >=${params.repeatK} repeat edges (deepest: ${deepest})`);
  }

  // Vehicles.
  if (params.vehiclePiids && params.vehiclePiids.length > 0) {
    const piids = new Set(params.vehiclePiids);
    if (!node.vehicles.some((v) => piids.has(v.parent_piid)))
      reasons.push("no disclosed sub $ under selected vehicles");
  }

  // Prime-backed — over the FULL lane set.
  if (params.primeBackedOnly && !allFacts.some(([, fact]) => fact.pb))
    reasons.push("no prime-backed lane overlap");

  // Combo overlap — over the FULL lane set.
  if (comboSet && scopedFacts.length === 0) reasons.push("no overlap with selected combos");

  return { status: reasons.length === 0 ? "lit" : "dim", reasons, unknowns };
}

// ── Plotting (lat/lon → the us-geo 1000x590 viewBox) ─────────────────────────

export type PlottedSubUniverseNode = SubUniverseNode & { x: number; y: number };

export type SubUniversePlot = {
  /** Nodes that landed on the canvas — the dot layer. */
  plotted: PlottedSubUniverseNode[];
  /** Nodes served without a plottable point (no coordinates, or outside the
   * Albers composite) — counted honestly in the console, never dotted at a
   * bogus spot. */
  unplotted: SubUniverseNode[];
};

type Projector = (lon: number, lat: number) => { x: number; y: number } | null;

/**
 * Project the buyer nodes onto the map — mirrors `plotSubout`. Nodes without
 * coordinates (or that geoAlbersUsa cannot place) go to `unplotted`.
 * `project` is injectable for tests; production uses the shared Albers projector.
 */
export function plotSubUniverse(
  nodes: SubUniverseNode[],
  project: Projector = projectLonLat,
): SubUniversePlot {
  const plotted: PlottedSubUniverseNode[] = [];
  const unplotted: SubUniverseNode[] = [];
  for (const node of nodes) {
    const p =
      node.latitude != null && node.longitude != null
        ? project(node.longitude, node.latitude)
        : null;
    if (p) plotted.push({ ...node, x: p.x, y: p.y });
    else unplotted.push(node);
  }
  return { plotted, unplotted };
}

// ── The evaluated layer (what MapView + the console render) ──────────────────

export type EvaluatedSubUniverseNode = PlottedSubUniverseNode & {
  evaluation: SubUniverseEvaluation;
};

export type SubUniverseLayer = {
  /** Plottable nodes carrying their gate evaluation — lit at full accent,
   * dim at low opacity. NEVER removed by a gate. */
  plotted: EvaluatedSubUniverseNode[];
  /** Non-plottable nodes, still evaluated — the console's honest "no geo" count. */
  unplotted: (SubUniverseNode & { evaluation: SubUniverseEvaluation })[];
  /** Lit/dim counts across ALL returned nodes (plotted + unplotted). */
  litCount: number;
  dimCount: number;
};

/** Plot + evaluate in one pure pass — the DemoApp memo body. */
export function buildSubUniverseLayer(
  nodes: SubUniverseNode[],
  params: SubUniverseGateParams,
  project: Projector = projectLonLat,
): SubUniverseLayer {
  const plot = plotSubUniverse(nodes, project);
  let litCount = 0;
  let dimCount = 0;
  const attach = <T extends SubUniverseNode>(node: T) => {
    const evaluation = evaluateNode(node, params);
    if (evaluation.status === "lit") litCount++;
    else dimCount++;
    return { ...node, evaluation };
  };
  return {
    plotted: plot.plotted.map(attach),
    unplotted: plot.unplotted.map(attach),
    litCount,
    dimCount,
  };
}

// ── Filter-option builders (the console's chip vocabularies) ─────────────────

/** How many top node-derived combos/vehicles join the chip vocabulary. */
const TOP_OPTION_CT = 15;

/**
 * The combo-chip vocabulary: the target's demonstrated combos first, then the
 * top distinct matched_via combos across nodes by aggregate matched farm-out $
 * (capped), de-duplicated in that order.
 */
export function comboOptions(
  target: SubUniverseTarget,
  nodes: SubUniverseNode[],
  topN: number = TOP_OPTION_CT,
): string[] {
  const byDollars = new Map<string, number>();
  // Undisclosed farm-out $ ranks as 0 — this orders the chip vocabulary
  // only; it is NOT a gate fact (unknown never fails a gate).
  for (const node of nodes)
    for (const m of node.matched_via)
      byDollars.set(m.combo, (byDollars.get(m.combo) ?? 0) + (m.farmout_amt_60mo ?? 0));
  const top = [...byDollars.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([combo]) => combo);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const combo of [...target.demonstrated_combos.map((c) => c.combo), ...top]) {
    if (!seen.has(combo)) {
      seen.add(combo);
      out.push(combo);
    }
  }
  return out;
}

/**
 * The vehicle-chip vocabulary: the target's own vehicle PIIDs first, then the
 * top node vehicle PIIDs by aggregate farm-out $ (capped), de-duplicated.
 */
export function vehicleOptions(
  target: SubUniverseTarget,
  nodes: SubUniverseNode[],
  topN: number = TOP_OPTION_CT,
): string[] {
  const byDollars = new Map<string, number>();
  for (const node of nodes)
    for (const v of node.vehicles)
      byDollars.set(v.parent_piid, (byDollars.get(v.parent_piid) ?? 0) + v.farmout_amt_60mo);
  const top = [...byDollars.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([piid]) => piid);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piid of [...target.vehicles.map((v) => v.parent_piid), ...top]) {
    if (!seen.has(piid)) {
      seen.add(piid);
      out.push(piid);
    }
  }
  return out;
}

/** Uniform dot radius — facts-only, no scoring, so every dot reads equal. */
export const SUB_UNIVERSE_DOT_RADIUS = 3;
