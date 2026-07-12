/**
 * Aggregate-mode phrase client — phrase-agg.v1 (catalyst, via the verbatim
 * /api/v1/federal/phrase broker).
 *
 * The SAME endpoint as the retrieval phrase compiler: the reserved opener
 * `total` routes the phrase to catalyst's aggregate grammar (closed vocabulary,
 * zero LLM — any unbound token 422s naming the token). The response carries
 * BARS instead of rows, plus the full disclosure surface (bindings, plan,
 * artifact stamp) — every demo click is a definable, disclosable recipe.
 */

import type { AggregateBar, ResolvedAggregate } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type AggregateBinding = {
  tokens: string[];
  axis: string;
  op: string | null;
  value: unknown;
};

export type AggregatePhraseResponse = {
  meta: {
    compilerVersion: string;
    mode: "aggregate";
    phrase: string;
    bindings: AggregateBinding[];
    plan: {
      grain: "aggregate";
      source: string;
      measure: string;
      group_by: string;
      fy: [number, number] | null;
      /** v2 (active near <zip>): the resolved geo anchor, disclosed. */
      anchor?: { zip: string; lat: number; lon: number; radius_mi: number };
    }[];
    title: string;
    unitLabel: string;
    matchedRows: number;
    totalGroups: number;
    /** The pinned sidecar snapshot the bars came from — provenance, disclosed. */
    artifact: string;
    elapsedMs: number;
  };
  data: { bars: AggregateBar[] };
};

export async function fetchAggregatePhrase(phrase: string): Promise<AggregatePhraseResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/phrase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail: string | null = null;
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? null;
    } catch {
      /* non-JSON error body — fall through to the generic message */
    }
    throw new Error(detail ?? `phrase failed: ${res.status}`);
  }
  return JSON.parse(text) as AggregatePhraseResponse;
}

/** Aggregate envelope → the renderer's `ResolvedAggregate` (AggregateView). */
export function toResolvedAggregate(res: AggregatePhraseResponse): ResolvedAggregate {
  const source = res.meta.plan[0]?.source ?? "";
  return {
    title: res.meta.title,
    groupBy: res.meta.plan[0]?.group_by ?? "industry",
    unitLabel: res.meta.unitLabel,
    matchedRows: res.meta.matchedRows,
    totalGroups: res.meta.totalGroups,
    bars: res.data.bars,
    notApplied: [],
    // Open-award sources count AWARDS (per-unit avg is meaningful); the
    // combo×FY portrait counts award ACTIONS.
    countNoun: source.startsWith("gtm_open_awards") ? "award" : "action",
  };
}
