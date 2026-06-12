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
  dataset: "company" | "winners" | "awards" | "auto" = "auto",
): Promise<AskMarketResult> {
  const qs = new URLSearchParams({ q, dataset });
  return getJson<AskMarketResult>(`/api/v1/federal/ask?${qs.toString()}`);
}
