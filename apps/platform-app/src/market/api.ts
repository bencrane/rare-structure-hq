/**
 * Market API — the audience-builder client (the Market tab's data source).
 *
 * Mirrors src/pipeline/api.ts: VITE_API_BASE_URL base + the Supabase session JWT
 * as a Bearer; the BFF (platform-api routes/market.ts) validates the session and
 * proxies verbatim to core-x edge_api's /api/v1/audience/* behind the service
 * token. `{ data }` envelope unwrapped here.
 *
 * Row shapes are the gtm.audience_* Postgres columns verbatim (snake_case) —
 * day-stale mirrors of the Lance audience marts. The envelope keys (total, asOf,
 * rows, byEnrichmentState, nLeads…) are camelCase per the contract.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// ── Filter payload (the frozen shared shape) ─────────────────────────────────

export type LaneFilter = {
  naicsPrefix?: string;
  pscPrefix?: string;
  naics?: string;
  psc?: string;
  /** `amt24moMin` on subbedUnder lanes, `obl24moMin` on primedIn lanes. */
  amt24moMin?: number;
  obl24moMin?: number;
};

export type AudienceFilters = {
  // entity-grain gates (gtm.audience_entities)
  employeeSizeBands?: string[];
  popStates?: string[];
  physicalStates?: string[];
  subAmt24moMin?: number;
  subAmt24moMax?: number;
  primeObl24moMin?: number;
  primeObl24moMax?: number;
  inDsbs?: boolean;
  isFfata?: boolean;
  dsbsCerts?: string[];
  fsrsAnyDesignation?: boolean;
  minDialable?: number;
  // behavior gates (lanes; ANDed as EXISTS semi-joins)
  subbedUnder?: LaneFilter[];
  primedIn?: LaneFilter[];
  // person-grain gate for people endpoints
  enrichmentStates?: string[];
};

/**
 * People-drawer narrowing: the shared filter shape plus a uei pin so the drawer
 * can fetch one entity's people. The frozen AudienceFilters carries no entity
 * key; `ueis` is the narrowing key sent to people/query (the drawer also
 * filters the returned rows client-side by uei as a belt-and-braces).
 */
export type PeopleFilters = AudienceFilters & { ueis?: string[] };

// ── Row shapes (gtm.audience_* columns, snake_case verbatim) ─────────────────

export interface EntityRow {
  uei: string;
  legal_business_name: string | null;
  normalized_domain: string | null;
  physical_city: string | null;
  physical_state: string | null;
  primary_pop_state: string | null;
  primary_naics: string | null;
  employee_size_band: string | null;
  sub_amt_24mo: number | null;
  sub_amt_24mo_band: string | null;
  prime_obl_24mo: number | null;
  prime_obl_24mo_band: string | null;
  in_dsbs: boolean | null;
  is_ffata_disclosing: boolean | null;
  n_sam_people: number | null;
  n_dialable: number | null;
  n_emailable: number | null;
  /** dsbs_* / fsrs_* designation flags (and any further subset cols) ride along verbatim. */
  [key: string]: unknown;
}

export interface PersonRow {
  sam_person_id: string;
  uei: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  dm_class: string | null;
  enrichment_state: string | null;
  phone: string | null;
  phone_status: string | null;
  email: string | null;
  email_verification_status: string | null;
  /** Entity ride-alongs (name/domain) and remaining person cols verbatim. */
  [key: string]: unknown;
}

/** ops.close_push_runs row (snake_case verbatim). */
export interface PushRun {
  run_id: string;
  requested_by: string | null;
  mode: "push" | "enrich";
  status: "running" | "done" | "error";
  n_leads_created: number;
  n_contacts_created: number;
  n_updated: number;
  n_skipped_ledgered: number;
  error: string | null;
  batch_label: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ── Response envelopes ───────────────────────────────────────────────────────

export interface EntityPage {
  total: number;
  asOf: string | null;
  rows: EntityRow[];
}

export interface AudienceCounts {
  total: number;
  totalPeople: number;
  byEnrichmentState: Record<string, number>;
}

export interface PeoplePage {
  total: number;
  rows: PersonRow[];
}

export interface PushDryRun {
  nLeads: number;
  nContacts: number;
  nAlreadyLedgered: number;
  sample: unknown[];
}

export type ContactStrategy = "dialable_plus_best" | "dialable_only" | "all";

export interface PushRequest {
  filters: AudienceFilters;
  contactStrategy: ContactStrategy;
  cohortName: string;
  dryRun: boolean;
}

/** dryRun:true → synchronous preview; dryRun:false → `{ runId }` to poll. */
export type PushResult = PushDryRun | { runId: string };

// ── Client ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function post<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1/market${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`market ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as T;
}

/** One page of matching entities, prime_obl_24mo DESC NULLS LAST (limit ≤ 200). */
export function queryEntities(
  token: string,
  filters: AudienceFilters,
  limit = 50,
  offset = 0,
): Promise<EntityPage> {
  return post<EntityPage>(token, "/entities/query", { filters, limit, offset });
}

/** Fast aggregate for the filter rail: entities, people, byEnrichmentState. */
export function countEntities(token: string, filters: AudienceFilters): Promise<AudienceCounts> {
  return post<AudienceCounts>(token, "/entities/count", { filters });
}

/** People matching the filters (person cols + entity name/domain ride-alongs). */
export function queryPeople(
  token: string,
  filters: PeopleFilters,
  limit = 200,
): Promise<PeoplePage> {
  return post<PeoplePage>(token, "/people/query", { filters, limit });
}

/** Push the audience to Close — dryRun:true previews, dryRun:false starts a run. */
export function pushAudience(token: string, req: PushRequest): Promise<PushResult> {
  return post<PushResult>(token, "/push", req);
}

/** One push run (the 2s poll target while a live push executes). */
export async function getRun(token: string, id: string): Promise<PushRun> {
  const res = await fetch(`${API_BASE}/api/v1/market/runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`market run failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as PushRun;
}

/** Recent push runs, newest first. */
export async function listRuns(token: string): Promise<PushRun[]> {
  const res = await fetch(`${API_BASE}/api/v1/market/runs`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`market runs failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as PushRun[];
}
