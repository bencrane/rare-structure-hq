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

import type { ComposedFilter, WorkbenchCatalog } from "./workbench";

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

// ── Entity dossier (the side-panel read) ─────────────────────────────────────
// Mirrors catalyst_api EntityDossierResponse (camelCase wire via the BFF pass-through).
// POCs carry name/title/geo only — the SAM source has no email/phone columns.

export type DossierAddress = {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type EntityDossier = {
  identity: {
    uei: string | null;
    cageCode: string | null;
    legalBusinessName: string | null;
    dbaName: string | null;
    isActive: boolean | null;
    primaryNaics: string | null;
    address: DossierAddress | null;
  };
  posture: {
    totalLifetimeObligations: number | null;
    totalActiveObligations: number | null;
    awardCount: number | null;
    activeAwardCount: number | null;
    hasFederalAwards: boolean | null;
    latestActionDate: string | null;
    daysSinceLastAction: number | null;
    topAgencies: { name: string; dollars: number }[];
    profileAsOfDate: string | null;
  };
  recentActivity: {
    windowDays: number;
    actions: {
      awardId: string | null;
      actionDate: string | null;
      amount: number | null;
      awardingAgency: string | null;
      awardingSubAgency: string | null;
      winnerType: string | null;
      popState: string | null;
      popCity: string | null;
      setAside: string | null;
      naicsCode: string | null;
    }[];
  };
  pocs: {
    type: string | null;
    pocSlotNo: number | null;
    fullName: string | null;
    title: string | null;
    city: string | null;
    state: string | null;
  }[];
};

/** Fetch the entity dossier for the side panel — a request-time composed read (NOT the
 * warm snapshot): catalyst gold identity/rollups/POCs ⊕ recency ⊕ rolling-90d actions. */
export function fetchEntityDossier(uei: string): Promise<EntityDossier> {
  return getJson<EntityDossier>(`/api/v1/federal/entity/${encodeURIComponent(uei)}/dossier`);
}

/** A NAICS/PSC code stat — count/dollars normalized across the sub and prime sides. */
export type CapabilityCodeStat = {
  code: string | null;
  description: string | null;
  count: number | null;
  dollars: number | null;
};

/** A prime/sub partner the firm has transacted with. */
export type CapabilityPartner = {
  name: string | null;
  uei: string | null;
  count: number | null;
  dollars: number | null;
};

/** A recommended expansion lane. The primes in `topPrimes` sub this lane out — the teaming targets. */
export type CapabilityLane = {
  rank: number | null;
  evidenceTier: string | null;
  naics: string | null;
  psc: string | null;
  naicsDescription: string | null;
  pscDescription: string | null;
  score: number | null;
  lanePrimes: number | null;
  laneMedianAmount: number | null;
  topPrimes: string[];
};

/** The per-firm capability profile card (catalyst /entities/{uei}/capability-profile). Covers
 * active subs and never-subbed DSBS alike — `federalStatus` makes the role a status, not the shape. */
export type CapabilityProfile = {
  uei: string | null;
  firmName: string | null;
  stateCode: string | null;
  parentUei: string | null;
  federalStatus: string | null;
  isDsbs: boolean | null;
  hasSubHistory: boolean | null;
  hasPrimeHistory: boolean | null;
  designations: string[];
  subActivity: {
    amount5y: number | null;
    subawards5y: number | null;
    distinctPrimes5y: number | null;
    distinctPrimePartners5y: number | null;
    recentSubawards90d: number | null;
    recentSubawardAmount90d: number | null;
    recentLatestActionDate: string | null;
    recentTopPrimeName: string | null;
    recentTopNaicsCode: string | null;
    recentTopNaicsDescription: string | null;
    recentSubawardScope: string | null;
    topPrimePartners: CapabilityPartner[];
    topNaics: CapabilityCodeStat[];
  } | null;
  primeActivity: {
    awards5y: number | null;
    obligated5y: number | null;
    competedAwards5y: number | null;
    distinctNaics5y: number | null;
    topNaics: CapabilityCodeStat[];
    topPsc: CapabilityCodeStat[];
    topAgencies: {
      agency: string | null;
      subAgency: string | null;
      count: number | null;
      dollars: number | null;
    }[];
  } | null;
  recommendedLanes: CapabilityLane[];
  nRecommendedLanes: number | null;
  topEvidenceTier: string | null;
  materializedAt: string | null;
};

/** Fetch the per-firm capability profile card. Public dumb-BFF broker, same posture as dossier. */
export function fetchEntityCapabilityProfile(uei: string): Promise<CapabilityProfile> {
  return getJson<CapabilityProfile>(
    `/api/v1/federal/entity/${encodeURIComponent(uei)}/capability-profile`,
  );
}

/** Batch dossier read (≤100 UEIs) — the eager-prefetch path. PARTIAL SUCCESS: the map
 * carries `null` for unknown UEIs; known ones land as full EntityDossier objects. */
export async function fetchEntityDossiers(
  ueis: string[],
): Promise<Record<string, EntityDossier | null>> {
  const res = await fetch(`${API_BASE}/api/v1/federal/entity/dossiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ueis }),
  });
  if (!res.ok) throw new Error(`federal dossiers batch failed: ${res.status}`);
  return (await res.json()).data as Record<string, EntityDossier | null>;
}

// ── Query workbench (the deterministic filter surface) ──────────────────────
// Two BFF brokers to catalyst's map query engine: the field catalog and the composed-
// filter query. NO LLM anywhere on this path — the workbench composes filters explicitly
// and the engine validates them deterministically. Types live in `workbench.ts` (the pure
// logic module); these are just the wire calls.

/** Fetch the field catalog — which fields/ops/enums each dataset supports. The workbench's
 * dropdowns are populated ONLY from this response, never from hardcoded lists. */
export function fetchQueryFields(): Promise<WorkbenchCatalog> {
  return getJson<WorkbenchCatalog>("/api/v1/federal/query-fields");
}

/** One returned row: a GeoJSON feature — `properties` carries the display columns;
 * `geometry` may be null (non-plottable row). */
export type WorkbenchFeature = {
  type: "Feature";
  geometry: unknown | null;
  properties: Record<string, unknown>;
};

export type WorkbenchQueryMeta = {
  dataset: string;
  decoderVersion: string;
  returned: number;
  plottable: number;
  total: number;
  capped: boolean;
};

export type WorkbenchQueryResponse = {
  data: { type: "FeatureCollection"; features: WorkbenchFeature[] };
  meta: WorkbenchQueryMeta;
};

/**
 * Run one composed deterministic query. Returns BOTH `data` and `meta` (unlike `getJson`,
 * which strips to `.data` — the workbench renders the meta honestly).
 *
 * Errors are NEVER swallowed: a 422 carries catalyst's `"invalid filter: …"` detail —
 * thrown VERBATIM (it is the "axis not yet configured" signal the workbench exists to
 * surface); any other failure throws status + raw body.
 */
export async function runWorkbenchQuery(
  dataset: string,
  body: { filters: ComposedFilter[]; limit: number },
): Promise<WorkbenchQueryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/query/${encodeURIComponent(dataset)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed?.detail === "string") detail = parsed.detail;
    } catch {
      /* non-JSON error body — fall through to the raw surface */
    }
    throw new Error(detail ?? `query ${dataset} failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as WorkbenchQueryResponse;
}

/** A flattened edge `/ask` GeoJSON row — the serving-table properties + real coordinates. */
export type AskMarketRow = Record<string, unknown> & { lat?: number; lon?: number };

/** One group of an aggregate result — a measure rolled up over the cohort. `sum`/`avg`/
 * `median`/`p90` per the requested metrics; `lo`/`hi` bound a size_band; `uei` is the entity
 * key on a 'winner' grouping. */
export type MarketAggregateGroup = {
  key: string | number | null;
  count: number;
  sum?: number | null;
  avg?: number | null;
  median?: number | null;
  p90?: number | null;
  lo?: number | null;
  hi?: number | null;
  uei?: string | null;
};

/** The aggregate side of an /ask result — present (instead of `rows`) when the query asked
 * for a breakdown / total / distribution / ranking over award actions. */
export type MarketAggregate = {
  groupBy: string;
  measure: string;
  metrics: string[];
  matchedRows: number;
  totalGroups: number;
  groups: MarketAggregateGroup[];
};

/** The NL market-query result: matched rows OR an aggregate, the full match total, and the
 * interpreted filter. */
export type AskMarketResult = {
  rows: AskMarketRow[];
  total: number;
  capped: boolean;
  /** Present for breakdown/total/distribution/ranking queries — the aggregate in place of rows. */
  aggregate?: MarketAggregate | null;
  query: {
    title?: string;
    filters: { field: string; op: string; value: unknown }[];
    unmapped?: string[];
  } | null;
  /** Constraints the compiler could NOT express (the honesty contract) — rendered as
   * "not applied" so the result never implies a filter it didn't run. */
  unmapped: string[];
  /** The dataset that executed (router-resolved when "auto" was requested). */
  dataset: string;
};

/**
 * Natural-language market query. UNLIKE the warm endpoints above, this hits the BFF's `/ask`
 * proxy → core-x edge_api (one forced-tool Anthropic call → catalyst_api Lance scan), so it is
 * a real (sub-few-second) round-trip, not an in-memory snapshot read.
 */
export function askMap(
  q: string,
  dataset: "company" | "winners" | "awards" | "active" | "contracts" | "auto" = "auto",
): Promise<AskMarketResult> {
  const qs = new URLSearchParams({ q, dataset });
  return getJson<AskMarketResult>(`/api/v1/federal/ask?${qs.toString()}`);
}
