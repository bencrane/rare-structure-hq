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
import type { SubUniverseRequest, SubUniverseResponse } from "./subUniverse";
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

// ── Sub-universe (the per-UEI eligible-buyer map layer) ──────────────────────

/**
 * Fetch the sub-universe for one UEI — catalyst's `sub_universe.v1` recipe via
 * the BFF's verbatim broker (same LRU/TTL response cache as the subout broker).
 * Returns the FULL envelope (data + target + meta): the console seeds its gates
 * from target.defaults and renders meta (cache_state, reason, capped) honestly.
 * A 422 carries catalyst's fail-closed detail verbatim.
 */
export async function fetchSubUniverse(body: SubUniverseRequest): Promise<SubUniverseResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/sub-universe`, {
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
    throw new Error(detail ?? `sub-universe failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as SubUniverseResponse;
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

// ── Q1 canonical-query typeahead (active-awards) ─────────────────────────────
// The ⌘K palette completes the approved Q1 sentence from a canonical vocabulary
// (~304 job phrases). The vocab is fetched ONCE on palette open and cached at
// module scope; candidate rows are composed client-side (no cross-product).

/** One canonical job phrase — stored in "to: …" form; `combo_count` ranks the
 * empty-input suggestions. */
export type JtbdPhrase = { phrase: string; combo_count: number };

/** One canonical occupation token — the `and need <occupation>` labor-need vocabulary;
 * `soc_count` (number of SOC codes behind the token) ranks the suggestions. */
export type Occupation = { token: string; soc_count: number };

/** The `/jtbd-vocab` payload — the job-phrase vocabulary plus the occupation vocabulary
 * (the Q1/Q2 typeahead resolves the `and need <occupation>` slot from the latter). */
export type JtbdVocab = { phrases: JtbdPhrase[]; occupations: Occupation[] };

let vocabCache: JtbdVocab | null = null;
let vocabInflight: Promise<JtbdVocab> | null = null;

/** Fetch the canonical vocabulary once (module-level cache) — both the job phrases and the
 * occupation tokens. Concurrent callers share the in-flight request; a failure clears the
 * latch so a later open retries. */
export async function fetchJtbdVocab(): Promise<JtbdVocab> {
  if (vocabCache) return vocabCache;
  if (vocabInflight) return vocabInflight;
  vocabInflight = (async () => {
    const res = await fetch(`${API_BASE}/api/v1/federal/jtbd-vocab`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`jtbd-vocab failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { phrases?: JtbdPhrase[]; occupations?: Occupation[] };
    vocabCache = { phrases: body.phrases ?? [], occupations: body.occupations ?? [] };
    return vocabCache;
  })();
  try {
    return await vocabInflight;
  } catch (e) {
    vocabInflight = null;
    throw e;
  } finally {
    vocabInflight = null;
  }
}

/** The body for one completed Q1/Q2 sentence run. */
export type ActiveAwardsQueryBody = {
  /** Total/single grain — omitted on event verbs (Q3) and step-growth (Q4). */
  grain?: "total" | "single";
  /** Active obligations (default), won-in-window, FPDS modification events (Q3), or
   * step-growth (Q4). */
  mode?: "active" | "won" | "events" | "growth";
  /** Q3 event verb sent verbatim (required iff `mode === "events"`). */
  event_verb?: string;
  /** Window length in days (required iff `mode === "won" | "events"`). */
  window_days?: number;
  /** Q4 step-growth multiplier — one of 2/3/4/5/10 (required iff `mode === "growth"`). */
  multiplier?: number;
  /** Q4 step-growth window pair (required iff `mode === "growth"`) — "12v24" | "6v12" | "90v90". */
  window_pair?: "12v24" | "6v12" | "90v90";
  job_phrase?: string;
  /** Place-of-performance state (2-letter). */
  state?: string;
  /** HQ state (2-letter) — the `based in <state>` slot. */
  hq_state?: string;
  /** Industry vertical token. */
  industry?: string;
  /** Occupation token — the `and need <occupation>` labor need. */
  need?: string;
  /** Pricing family (Q1/Q2 only) — "fixed price" | "cost plus" | "time and materials".
   * The edge 422s this on events/growth (award-latest-state, award grain). */
  billing?: "fixed price" | "cost plus" | "time and materials";
  /** Financing arrangement (Q1/Q2 only) — "with progress payments" | "without progress
   * payments". The edge 422s this on events/growth (award-latest-state, award grain). */
  financing?: "with progress payments" | "without progress payments";
  min_amt?: number;
  /** Include support/indirect roles in the labor-need match (default false). */
  include_support?: boolean;
  limit?: number;
};

/** One returned company row from the active-awards query. */
export type ActiveAwardsRow = {
  latitude?: number | null;
  longitude?: number | null;
  uei: string;
  legal_business_name: string;
  physical_city: string | null;
  physical_state: string | null;
  normalized_domain: string | null;
  /** Q1/Q2 (active/won) obligation columns. */
  active_total_obl?: number;
  active_max_single?: number;
  active_award_ct?: number;
  /** Q3 (events) columns — Σ obligations moved by the events and the action count. */
  event_obl?: number;
  event_actions?: number;
  /** Q4 (growth) columns — Σ obligations in the recent window A, the prior window B, and the
   * ratio A/B. */
  window_obl?: number;
  prior_obl?: number;
  growth_ratio?: number;
};

export type ActiveAwardsResponse = {
  query: unknown;
  total: number;
  rows: ActiveAwardsRow[];
  elapsed_ms?: number;
  artifact?: unknown;
};

/** Run one completed Q1 sentence — catalyst's active-awards query via the BFF's verbatim
 * broker. A refusal surfaces the upstream detail verbatim (same posture as the phrase path). */
export async function fetchActiveAwardsQuery(
  body: ActiveAwardsQueryBody,
): Promise<ActiveAwardsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/federal/active-awards-query`, {
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
    throw new Error(detail ?? `active-awards-query failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as ActiveAwardsResponse;
}
