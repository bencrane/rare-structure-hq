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

import type { PhraseResponse } from "./phrase";
import type { SuboutRequest, SuboutResponse } from "./subout";
import type { CodeRegistry, ComposedFilter, WorkbenchCatalog } from "./workbench";

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

/** One code-registry hit for the typeahead — prefix-beats-substring ranked upstream. */
export type CodeSuggestion = { code: string; description: string };

/** Search a code registry (naics | psc | agency — the workbench's typeahead value
 * editor). Empty `q` is rejected upstream (422) — callers gate on non-empty input. */
export function fetchQueryCodes(
  type: CodeRegistry,
  q: string,
  limit = 20,
): Promise<CodeSuggestion[]> {
  const qs = new URLSearchParams({ type, q, limit: String(limit) });
  return getJson<CodeSuggestion[]>(`/api/v1/federal/query-codes?${qs.toString()}`);
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

// ── Sub-out opportunities (the per-UEI map layer) ────────────────────────────

/**
 * Fetch the sub-out opportunities for one UEI — catalyst's `subout_opportunities.v2`
 * recipe via the BFF's verbatim broker (15-min upstream response cache; first hit per
 * UEI can take a few seconds on the inferred probe, cached hits are ~200ms). Returns
 * BOTH `meta` and `data` (meta carries target_hq, cache_state, timings, notes — the
 * console renders them honestly). A 422 carries catalyst's fail-closed detail verbatim.
 */
export async function fetchSuboutOpportunities(body: SuboutRequest): Promise<SuboutResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/subout-opportunities`, {
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
    throw new Error(detail ?? `subout-opportunities failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as SuboutResponse;
}

// ── Deterministic phrase compiler (phrase.v1) ────────────────────────────────

/**
 * Compile-and-run a phrase — catalyst's CLOSED-grammar compiler via the BFF's
 * verbatim broker. Returns meta (bindings, plan, honest counts) + the terminal
 * step's rows. A refusal is a 422 whose detail NAMES the offending token —
 * thrown verbatim (it is the vocabulary teaching surface).
 */
export async function fetchPhrase(phrase: string): Promise<PhraseResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/phrase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
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
    throw new Error(detail ?? `phrase failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as PhraseResponse;
}
