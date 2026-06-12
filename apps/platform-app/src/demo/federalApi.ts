/**
 * Federal serving client — the cockpit's LIVE data source (replaces the mock fixtures).
 *
 * PUBLIC + UNAUTHENTICATED. The `/map` cockpit is a public route, and the BFF's
 * `/api/v1/federal/*` endpoints are public (warm, in-memory projections of precomputed
 * public federal-spend data). So these fetches carry NO Authorization header — matching
 * the public tier of the house fetch pattern (cf. the public proposal-shell read).
 *
 * WARM ALL THE WAY DOWN. The BFF serves these from an in-memory snapshot loaded at boot
 * (core-x precompute → bundled static artifact). The request path never opens Lance or
 * runs DuckDB; these calls return in milliseconds.
 */

import type {
  FederalAgencyChart,
  FederalEntity,
  FederalEntityList,
  FederalIndustryChart,
  FederalStateChart,
} from "@rare-structure-hq/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`federal ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as T;
}

/** Filters for the entity list/filter query — the widened map-query axis. */
export type FederalEntityFilters = {
  /** NAICS code or 2–6 digit prefix. */
  naics?: string;
  /** Lifetime-obligation floor (USD). */
  minObligation?: number;
  /** 2-letter US state code. */
  state?: string;
  /** Only entities with active obligations. */
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
};

export function fetchIndustryChart(): Promise<FederalIndustryChart> {
  return getJson<FederalIndustryChart>("/api/v1/federal/spend-by-industry");
}

export function fetchStateChart(): Promise<FederalStateChart> {
  return getJson<FederalStateChart>("/api/v1/federal/spend-by-state");
}

export function fetchAgencyChart(): Promise<FederalAgencyChart> {
  return getJson<FederalAgencyChart>("/api/v1/federal/spend-by-agency");
}

export function fetchEntities(filters: FederalEntityFilters): Promise<FederalEntityList> {
  const qs = new URLSearchParams();
  if (filters.naics) qs.set("naics", filters.naics);
  if (filters.minObligation != null) qs.set("minObligation", String(filters.minObligation));
  if (filters.state) qs.set("state", filters.state);
  if (filters.activeOnly) qs.set("activeOnly", "true");
  if (filters.limit != null) qs.set("limit", String(filters.limit));
  if (filters.offset != null) qs.set("offset", String(filters.offset));
  const q = qs.toString();
  return getJson<FederalEntityList>(`/api/v1/federal/entities${q ? `?${q}` : ""}`);
}

export function fetchEntityByUei(uei: string): Promise<FederalEntity> {
  return getJson<FederalEntity>(`/api/v1/federal/entity/${encodeURIComponent(uei)}`);
}

/** A flattened edge `/ask` GeoJSON row — the serving-table properties + real coordinates. */
export type AskMarketRow = Record<string, unknown> & { lat?: number; lon?: number };

/** The NL market-query result: matched rows, the full match total, and the interpreted filter. */
export type AskMarketResult = {
  rows: AskMarketRow[];
  total: number;
  capped: boolean;
  query: {
    title?: string;
    filters: { field: string; op: string; value: unknown }[];
    unmapped?: string[];
  } | null;
  /** Constraints the compiler could NOT express (the honesty contract) — rendered as
   * "not applied" so the result never implies a filter it didn't run. */
  unmapped: string[];
  dataset: string;
};

/**
 * Natural-language market query. UNLIKE the warm endpoints above, this hits the BFF's `/ask`
 * proxy → core-x edge_api (one forced-tool Anthropic call → catalyst_api Lance scan), so it is
 * a real (sub-few-second) round-trip, not an in-memory snapshot read.
 */
export function askMap(
  q: string,
  dataset: "company" | "winners" = "company",
): Promise<AskMarketResult> {
  const qs = new URLSearchParams({ q, dataset });
  return getJson<AskMarketResult>(`/api/v1/federal/ask?${qs.toString()}`);
}
