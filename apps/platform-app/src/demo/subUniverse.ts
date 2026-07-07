/**
 * Sub-universe — pure types + gate evaluation + plotting for the per-UEI
 * eligible-buyer map layer.
 *
 * The wire is catalyst's `sub_universe.v1` recipe, brokered verbatim by the BFF
 * at POST /api/v1/federal/sub-universe: enter a sub's UEI → the buyers whose
 * demonstrated farm-out lanes overlap the sub's demonstrated combos, ordered by
 * matched farm-out $ desc. FACTS-ONLY DOCTRINE: there is no score anywhere.
 * The tunable gates (MVS floor, repeat depth, vehicles, prime-backed, combos)
 * never delete a node — a node failing any gate is DIMMED with every failing
 * gate's reason disclosed, and re-evaluation is entirely client-side (no
 * re-fetch on parameter change). This module owns everything testable without
 * a network: response types, gate semantics, lat/lon → viewBox projection
 * (dropping unplottable nodes honestly), and the filter-option builders.
 * The wire call itself lives in `federalApi.ts`.
 */

import { fmtUsd } from "./format";
import { projectLonLat } from "./projection";

// ── Wire types (catalyst sub_universe.v1, snake_case pass-through) ───────────

/** One matched lane: a (NAICS × PSC) combo the buyer farms out that the sub has
 * demonstrated. Capped at 25 per node upstream. */
export type SubUniverseMatchedVia = {
  combo: string;
  naics_code: string | null;
  psc_code: string | null;
  naics_title: string | null;
  psc_title: string | null;
  farmout_amt_60mo: number;
  median_chunk_60mo: number | null;
  median_chunk_lifetime: number | null;
  n_subawards_lifetime: number;
  n_distinct_subs_60mo: number;
  last_action_date: string | null;
  anchor_uei: string | null;
  anchor_obl_60mo: number | null;
  prime_backed: boolean;
};

/** The buyer's teaming posture — repeat-partner depth over 5y. */
export type SubUniverseTeaming = {
  n_sub_partners_5y: number;
  deepest_repeat_edges_5y: number;
  n_partners_ge_3_edges: number;
};

/** One vehicle (parent PIID) the buyer has disclosed sub $ under. */
export type SubUniverseVehicle = {
  parent_piid: string;
  farmout_amt_60mo: number;
  last_action_date: string | null;
};

/** One buyer node — a prime with matched farm-out lanes. lat/lon may be null. */
export type SubUniverseNode = {
  uei: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_precision: string | null;
  matched_farmout_60mo: number;
  n_matched_combos: number;
  matched_via: SubUniverseMatchedVia[];
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
    mvs_usd: number | null;
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
};

/** Seed the gates from the target's expressed defaults (MVS + repeat-K);
 * vehicle/combo filters and prime-backed start off. */
export function defaultGateParams(target: SubUniverseTarget): SubUniverseGateParams {
  return {
    mvsUsd: target.defaults.mvs_usd,
    repeatK: target.defaults.repeat_k ?? 3,
    vehiclePiids: null,
    primeBackedOnly: false,
    combos: null,
  };
}

export type SubUniverseEvaluation = {
  status: "lit" | "dim";
  /** Every failing gate's disclosed reason — a node failing multiple gates
   * accumulates ALL of them. Empty iff lit. */
  reasons: string[];
};

/**
 * Evaluate one node against the gates. Facts-only: a failing node is DIMMED
 * with reasons, never deleted. Gate semantics:
 *  - MVS floor: SOME matched lane (scoped to the combo filter when set) must
 *    disclose (median_chunk_60mo ?? median_chunk_lifetime) >= mvsUsd.
 *  - Repeat depth: teaming.deepest_repeat_edges_5y >= repeatK.
 *  - Vehicles: some node vehicle parent_piid is in the selected list.
 *  - Prime-backed: some matched lane carries prime_backed.
 *  - Combos: some matched lane's combo is in the selected set.
 */
export function evaluateNode(
  node: SubUniverseNode,
  params: SubUniverseGateParams,
): SubUniverseEvaluation {
  const reasons: string[] = [];
  const comboSet = params.combos && params.combos.length > 0 ? new Set(params.combos) : null;

  // MVS floor — scoped to the selected combos when the combo filter is on.
  if (params.mvsUsd != null) {
    const lanes = comboSet
      ? node.matched_via.filter((m) => comboSet.has(m.combo))
      : node.matched_via;
    let best: number | null = null;
    for (const m of lanes) {
      const chunk = m.median_chunk_60mo ?? m.median_chunk_lifetime;
      if (chunk != null && (best == null || chunk > best)) best = chunk;
    }
    if (best == null) reasons.push("no disclosed chunk medians");
    else if (best < params.mvsUsd)
      reasons.push(`below ${fmtUsd(params.mvsUsd)} floor — best median chunk ${fmtUsd(best)}`);
  }

  // Repeat depth.
  if (params.repeatK != null) {
    const deepest = node.teaming.deepest_repeat_edges_5y;
    if (deepest < params.repeatK)
      reasons.push(`no sub partner with >=${params.repeatK} repeat edges (deepest: ${deepest})`);
  }

  // Vehicles.
  if (params.vehiclePiids && params.vehiclePiids.length > 0) {
    const piids = new Set(params.vehiclePiids);
    if (!node.vehicles.some((v) => piids.has(v.parent_piid)))
      reasons.push("no disclosed sub $ under selected vehicles");
  }

  // Prime-backed.
  if (params.primeBackedOnly && !node.matched_via.some((m) => m.prime_backed))
    reasons.push("no prime-backed lane overlap");

  // Combo overlap.
  if (comboSet && !node.matched_via.some((m) => comboSet.has(m.combo)))
    reasons.push("no overlap with selected combos");

  return { status: reasons.length === 0 ? "lit" : "dim", reasons };
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
  for (const node of nodes)
    for (const m of node.matched_via)
      byDollars.set(m.combo, (byDollars.get(m.combo) ?? 0) + m.farmout_amt_60mo);
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
