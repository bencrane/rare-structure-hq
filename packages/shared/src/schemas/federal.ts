import { z } from "zod";

/**
 * Federal serving contract — shared by platform-api (BFF) and platform-app (cockpit).
 *
 * This is the WIRE shape for the live federal map/chart surface. The data is
 * PRECOMPUTED in core-x (`pipelines/serving/materialize_federal_charts.py`, which calls
 * the merged `apps/gtm_mcp/src/tools/federal.py` functions) and served WARM: the BFF
 * loads the materialized artifact into memory once at boot — the request path never
 * opens Lance or runs DuckDB. These schemas are the contract that artifact is projected
 * onto and the cockpit's `data.ts` selectors validate against.
 *
 * Provenance (`materializedAt` / `profileAsOfDate`) rides on every response so the UI
 * can render "data as of X" honestly.
 */

/** Provenance stamp — when the snapshot was built + the gold as-of date it reflects. */
export const federalProvenanceSchema = z.object({
  /** ISO-8601 instant the serving snapshot was materialized in core-x. */
  materializedAt: z.string(),
  /** The `entity_profile_gold` as-of date the snapshot reflects (ISO date), or null. */
  profileAsOfDate: z.string().nullable(),
});
export type FederalProvenance = z.infer<typeof federalProvenanceSchema>;

/**
 * One bar of the spend-by-industry chart — a NAICS code rolled up across the federal
 * universe. `naics` is the 6-digit code; lifetime + active obligation sums and the
 * number of firms in the group.
 */
export const federalIndustryBarSchema = z.object({
  naics: z.string().nullable(),
  spend_lifetime: z.number(),
  spend_active: z.number(),
  firms: z.number(),
});
export type FederalIndustryBar = z.infer<typeof federalIndustryBarSchema>;

/** One bar of the spend-by-state chart — a US jurisdiction (2-letter code). */
export const federalStateBarSchema = z.object({
  state: z.string(),
  spend_lifetime: z.number(),
  spend_active: z.number(),
  firms: z.number(),
});
export type FederalStateBar = z.infer<typeof federalStateBarSchema>;

/** One bar of the spend-by-agency chart — an awarding agency and its summed dollars. */
export const federalAgencyBarSchema = z.object({
  agency: z.string(),
  spend: z.number(),
  recipients: z.number(),
});
export type FederalAgencyBar = z.infer<typeof federalAgencyBarSchema>;

/** Chart response envelopes (provenance + the bars + the full group count). */
export const federalIndustryChartSchema = federalProvenanceSchema.extend({
  groupCount: z.number(),
  rows: z.array(federalIndustryBarSchema),
});
export type FederalIndustryChart = z.infer<typeof federalIndustryChartSchema>;

export const federalStateChartSchema = federalProvenanceSchema.extend({
  groupCount: z.number(),
  rows: z.array(federalStateBarSchema),
});
export type FederalStateChart = z.infer<typeof federalStateChartSchema>;

export const federalAgencyChartSchema = federalProvenanceSchema.extend({
  groupCount: z.number(),
  rows: z.array(federalAgencyBarSchema),
});
export type FederalAgencyChart = z.infer<typeof federalAgencyChartSchema>;

/**
 * One entity row in the map/list slice — the live replacement for the cockpit's mock
 * `COMPANIES`. Projected to the 9 list columns the serving snapshot carries, plus real
 * geographic coordinates (`lat`/`lon`, WGS-84). The serving precompute LEFT JOINs the
 * `geocode_xwalk` crosswalk on the canonical address hash, so an entity whose physical
 * address geocoded carries a dot; entities with no geocode hit carry `null` coordinates and
 * the map omits their dot (~85% of the federal universe resolves today).
 */
export const federalEntitySchema = z.object({
  uei: z.string(),
  legalNameBase: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  naics: z.string().nullable(),
  totalLifetimeObligations: z.number(),
  totalActiveObligations: z.number(),
  activeAwardCount: z.number(),
  hasFederalAwards: z.boolean(),
  /** WGS-84 lat/lon from the geocode crosswalk; `null` when the address did not geocode. */
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});
export type FederalEntity = z.infer<typeof federalEntitySchema>;

/**
 * The entity list/filter response — paginated, NO silent truncation. `total` is the
 * full matching count; `truncated` is true when rows remain beyond this page. Carries
 * the slice's stated bound (`minLifetimeBound`) and the full has-awards universe so the
 * UI can surface "showing firms ≥ $X of N total".
 */
export const federalEntityListSchema = federalProvenanceSchema.extend({
  total: z.number(),
  returned: z.number(),
  offset: z.number(),
  limit: z.number(),
  truncated: z.boolean(),
  /** The lifetime-obligation floor the serving slice was materialized to (stated bound). */
  minLifetimeBound: z.number(),
  /** Full `has_federal_awards=TRUE` universe size (for the "of N total" readout). */
  fullUniverse: z.number(),
  rows: z.array(federalEntitySchema),
});
export type FederalEntityList = z.infer<typeof federalEntityListSchema>;

/** Query params for the entity list endpoint (all optional; in-memory filtered). */
export const federalEntityQuerySchema = z.object({
  /** NAICS code or 2–6 digit prefix. */
  naics: z.string().optional(),
  /** Lifetime-obligation floor (on top of the materialized bound). */
  minObligation: z.coerce.number().optional(),
  /** 2-letter US state code. */
  state: z.string().optional(),
  /** Only entities with active obligations > 0. */
  activeOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(2000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});
export type FederalEntityQuery = z.infer<typeof federalEntityQuerySchema>;
