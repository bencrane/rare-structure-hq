/**
 * Federal serving store — the WARM, in-memory snapshot of the precomputed federal data.
 *
 * THE WARM INVARIANT. The federal map/chart surface must answer in milliseconds on a
 * public route. The underlying aggregations scan the full 1.54M-row `entity_profile_gold`
 * over Lance/DuckDB — a cold open costs ~60s. That path is FORBIDDEN at request time.
 * Instead core-x PRECOMPUTES the serving artifacts
 * (`pipelines/serving/materialize_federal_charts.py`) and this module loads them ONCE at
 * boot into process memory. Every request reads RAM — no Lance, no DuckDB, no core-x
 * round-trip on the request path.
 *
 * DELIVERY. The artifacts are bundled as static assets under `src/data/federal/`
 * (charts.json ~15KB; entities.json.gz ~3.6MB, 116,780 rows columnar+gzipped). They are
 * git-committed and copied into the runtime image, so the BFF needs NO R2 credentials and
 * NO new runtime dependency (zlib is built in). A refresh = re-run the core-x precompute,
 * re-export the assets, redeploy. The data is slow-changing; there is no cron.
 *
 * PROVENANCE. `materializedAt` + `profileAsOfDate` ride on every response so the cockpit
 * shows "data as of X" honestly.
 */

import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type {
  FederalAgencyChart,
  FederalEntity,
  FederalEntityList,
  FederalEntityQuery,
  FederalIndustryChart,
  FederalStateChart,
} from "@rare-structure-hq/shared";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "..", "data", "federal");

// ── Raw artifact shapes (as written by the core-x exporter) ──────────────────
type RawIndustryRow = {
  naics: string | null;
  spend_lifetime: number;
  spend_active: number;
  firms: number;
};
type RawStateRow = { state: string; spend_lifetime: number; spend_active: number; firms: number };
type RawAgencyRow = { agency: string; spend: number; recipients: number };
type RawCharts = {
  materialized_at: string;
  profile_as_of_date: string | null;
  spend_by_industry: { group_count: number; returned: number; rows: RawIndustryRow[] };
  spend_by_state: { group_count: number; rows: RawStateRow[] };
  spend_by_agency: { group_count: number; returned: number; rows: RawAgencyRow[] };
};

// The entity slice is columnar (one array per column) — compact on the wire, and the
// store flattens it into row objects once at boot.
type RawEntities = {
  materialized_at: string;
  profile_as_of_date: string | null;
  min_lifetime_obligation: number;
  full_has_awards_universe: number;
  row_count: number;
  columns: {
    uei: (string | null)[];
    legal_name_base: (string | null)[];
    physical_address_city: (string | null)[];
    physical_address_state: (string | null)[];
    primary_naics: (string | null)[];
    total_lifetime_obligations: number[];
    total_active_obligations: number[];
    active_award_count: number[];
    has_federal_awards: boolean[];
  };
};

// ── Boot-time load (module init = once per process) ──────────────────────────
const rawCharts: RawCharts = JSON.parse(readFileSync(join(DATA_DIR, "charts.json"), "utf-8"));
const rawEntities: RawEntities = JSON.parse(
  gunzipSync(readFileSync(join(DATA_DIR, "entities.json.gz"))).toString("utf-8"),
);

const provenance = {
  materializedAt: rawCharts.materialized_at,
  profileAsOfDate: rawCharts.profile_as_of_date,
};

// Flatten the columnar entity slice into row objects ONCE at boot. Already ordered by
// lifetime obligations desc by the precompute, so pagination is a plain slice.
const ENTITIES: FederalEntity[] = (() => {
  const c = rawEntities.columns;
  const out: FederalEntity[] = new Array(rawEntities.row_count);
  for (let i = 0; i < rawEntities.row_count; i++) {
    out[i] = {
      uei: c.uei[i] ?? "",
      legalNameBase: c.legal_name_base[i] ?? null,
      city: c.physical_address_city[i] ?? null,
      state: c.physical_address_state[i] ?? null,
      naics: c.primary_naics[i] ?? null,
      totalLifetimeObligations: c.total_lifetime_obligations[i] ?? 0,
      totalActiveObligations: c.total_active_obligations[i] ?? 0,
      activeAwardCount: c.active_award_count[i] ?? 0,
      hasFederalAwards: c.has_federal_awards[i] ?? false,
    };
  }
  return out;
})();

console.log(
  `federal-store: warm — ${ENTITIES.length.toLocaleString()} entities, ` +
    `${rawCharts.spend_by_industry.rows.length} industry / ${rawCharts.spend_by_state.rows.length} state / ` +
    `${rawCharts.spend_by_agency.rows.length} agency bars (as of ${provenance.profileAsOfDate}).`,
);

// ── Chart reads (constant-time projections of the in-memory snapshot) ─────────
export function industryChart(): FederalIndustryChart {
  return {
    ...provenance,
    groupCount: rawCharts.spend_by_industry.group_count,
    rows: rawCharts.spend_by_industry.rows,
  };
}

export function stateChart(): FederalStateChart {
  return { ...provenance, groupCount: rawCharts.spend_by_state.group_count, rows: rawCharts.spend_by_state.rows };
}

export function agencyChart(): FederalAgencyChart {
  return {
    ...provenance,
    groupCount: rawCharts.spend_by_agency.group_count,
    rows: rawCharts.spend_by_agency.rows,
  };
}

// ── Entity list/filter (in-memory; NO Lance, NO silent truncation) ───────────
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function naicsMatches(entityNaics: string | null, filter: string): boolean {
  if (!entityNaics) return false;
  // A full 6-digit code is an exact match; a 2–5 digit value is a prefix.
  return filter.length >= 6 ? entityNaics === filter : entityNaics.startsWith(filter);
}

export function entityList(q: FederalEntityQuery): FederalEntityList {
  const naics = q.naics?.trim() || undefined;
  const state = q.state?.trim().toUpperCase() || undefined;
  const minObligation = q.minObligation ?? 0;
  const activeOnly = q.activeOnly ?? false;
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(q.offset ?? 0, 0);

  // Single pass over the boot-flattened, pre-sorted slice — already lifetime-desc.
  const matched: FederalEntity[] = [];
  for (const e of ENTITIES) {
    if (naics && !naicsMatches(e.naics, naics)) continue;
    if (state && e.state?.toUpperCase() !== state) continue;
    if (minObligation > 0 && e.totalLifetimeObligations < minObligation) continue;
    if (activeOnly && !(e.totalActiveObligations > 0)) continue;
    matched.push(e);
  }

  const page = matched.slice(offset, offset + limit);
  return {
    ...provenance,
    total: matched.length,
    returned: page.length,
    offset,
    limit,
    truncated: offset + page.length < matched.length,
    minLifetimeBound: rawEntities.min_lifetime_obligation,
    fullUniverse: rawEntities.full_has_awards_universe,
    rows: page,
  };
}

export function entityByUei(uei: string): FederalEntity | null {
  const u = uei.trim().toUpperCase();
  if (!u) return null;
  return ENTITIES.find((e) => e.uei.toUpperCase() === u) ?? null;
}

export function snapshotProvenance() {
  return { ...provenance, entityCount: ENTITIES.length, fullUniverse: rawEntities.full_has_awards_universe };
}
