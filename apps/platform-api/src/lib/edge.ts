/**
 * edge_api client — the core-x engagement-proposal + Documenso v2 e-signature engine.
 *
 * The proposal/signing engine (render → DocRaptor → Documenso → webhook) lives in
 * core-x `apps/edge_api`. This BFF delegates to it across two trust boundaries:
 *   - CREATE / LIST  → service-token (`Authorization: Bearer ${EDGE_API_SERVICE_TOKEN}`)
 *   - PUBLIC ref read → unauthenticated (the proposal `ref` is the capability)
 *
 * Required env (Doppler `hq-rare-structure-hq`):
 *   EDGE_API_URL            base URL of the deployed edge_api service
 *   EDGE_API_SERVICE_TOKEN  shared secret matching edge_api's EDGE_API_SERVICE_TOKEN (core-x/prd)
 *   DOCUMENSO_APP_URL       embed host (default https://app.documenso.com)
 */

const EDGE_API_URL = (process.env.EDGE_API_URL ?? "").replace(/\/$/, "");
const EDGE_API_SERVICE_TOKEN = process.env.EDGE_API_SERVICE_TOKEN ?? "";

/** Documenso instance the embed must point at (must match where the envelope was created). */
export const DOCUMENSO_APP_URL = (
  process.env.DOCUMENSO_APP_URL ?? "https://app.documenso.com"
).replace(/\/$/, "");

export class EdgeError extends Error {}

function base(): string {
  if (!EDGE_API_URL) {
    throw new EdgeError(
      "EDGE_API_URL is not set (Doppler hq-rare-structure-hq → edge_api base URL)",
    );
  }
  return EDGE_API_URL;
}

function serviceHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${EDGE_API_SERVICE_TOKEN}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// ── Map /ask — the natural-language market query ─────────────────────────────
// edge_api owns the single forced-tool Anthropic call (NL → constrained filter) and the
// catalyst_api EXECUTE that runs it; this BFF is a thin service-token proxy. The /map cockpit
// is public, so the route is unauthenticated — but each call triggers one LLM round-trip, so
// this is the natural seam to add rate-limiting if abuse shows.
/** Requestable dataset: a concrete serving table, or "auto" — edge_api's router picks
 * the table from the sentence ("won an award over $X" → awards; lifetime-obligation /
 * firmographic phrasing → company). */
export type AskMarketDataset = "company" | "winners" | "awards" | "active" | "contracts" | "auto";
/** The dataset that actually EXECUTED (echoed back by catalyst; never "auto"). */
export type AskMarketExecutedDataset = "company" | "winners" | "awards" | "active" | "contracts";

export interface AskMarketRow {
  [key: string]: unknown;
  /** Real WGS84 coordinates from geocode_xwalk (carried for the deferred geo-dot layer). */
  lat?: number;
  lon?: number;
}

/** One group row of an aggregate result — a measure rolled up over the cohort. `sum`/`avg`/
 * `median`/`p90` are present per the requested metrics; `lo`/`hi` bound a size_band; `uei`
 * carries the entity key for a 'winner' grouping. */
export interface MarketAggregateGroup {
  key: string | number | null;
  count: number;
  sum?: number | null;
  avg?: number | null;
  median?: number | null;
  p90?: number | null;
  lo?: number | null;
  hi?: number | null;
  uei?: string | null;
}

/** The aggregate side of an /ask result: a cohort-scoped group-by over award actions. Present
 * (instead of `rows`) when the query asked for a breakdown / total / distribution / ranking. */
export interface MarketAggregate {
  groupBy: string;
  measure: string;
  metrics: string[];
  matchedRows: number;
  totalGroups: number;
  groups: MarketAggregateGroup[];
}

export interface AskMarketResult {
  rows: AskMarketRow[];
  total: number;
  capped: boolean;
  /** Present when the query was a breakdown/total/distribution/ranking — the aggregate
   * rows in place of the GeoJSON `rows`. Null for a plain row query. */
  aggregate: MarketAggregate | null;
  /** The interpreted filter the model produced — for the UI to echo "interpreted as…". */
  query: {
    title?: string;
    filters: { field: string; op: string; value: unknown }[];
    unmapped?: string[];
  } | null;
  /** Constraints the compiler could NOT express (the honesty contract) — the cockpit
   * renders these as "not applied" so the result never implies a filter it didn't run. */
  unmapped: string[];
  /** The dataset that executed (router-resolved when "auto" was requested). */
  dataset: AskMarketExecutedDataset;
}

interface RawAggregate {
  group_by: string;
  measure: string;
  metrics: string[];
  matched_rows: number;
  total_groups: number;
  groups: MarketAggregateGroup[];
}

interface GeoFeature {
  /** null geometry = a qualifying row whose address did not geocode (table-only row). */
  geometry?: { coordinates?: [number, number] } | null;
  properties?: Record<string, unknown>;
}

/** NL market query → edge_api `/api/v1/map/{dataset}/ask` → flattened rows (+ coords). */
export async function askMarket(dataset: AskMarketDataset, q: string): Promise<AskMarketResult> {
  const res = await fetch(`${base()}/api/v1/map/${dataset}/ask`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ q }),
  });
  if (!res.ok) {
    throw new EdgeError(`edge_api /ask failed: ${res.status} ${await res.text()}`);
  }
  const env = (await res.json()) as {
    data?: { features?: GeoFeature[]; aggregate?: RawAggregate };
    meta?: { returned?: number; total?: number; capped?: boolean; dataset?: string };
    query?: AskMarketResult["query"] & { dataset?: string };
  };
  const features = env.data?.features ?? [];
  const rows: AskMarketRow[] = features.map((f) => ({
    ...(f.properties ?? {}),
    lon: f.geometry?.coordinates?.[0],
    lat: f.geometry?.coordinates?.[1],
  }));
  // The aggregate envelope (snake_case from catalyst) → camelCase wire shape. Present only
  // for breakdown/total/distribution/ranking queries; the group rows pass through as-is.
  const aggRaw = env.data?.aggregate;
  const aggregate: MarketAggregate | null = aggRaw
    ? {
        groupBy: aggRaw.group_by,
        measure: aggRaw.measure,
        metrics: aggRaw.metrics ?? [],
        matchedRows: aggRaw.matched_rows ?? 0,
        totalGroups: aggRaw.total_groups ?? 0,
        groups: aggRaw.groups ?? [],
      }
    : null;
  const executed = (env.meta?.dataset ?? env.query?.dataset) as
    | AskMarketExecutedDataset
    | undefined;
  return {
    rows,
    // meta.total is the EXACT match count (pre-cap); `returned` is the served slice.
    total: env.meta?.total ?? env.meta?.returned ?? rows.length,
    capped: env.meta?.capped ?? false,
    aggregate,
    query: env.query ?? null,
    unmapped: env.query?.unmapped ?? [],
    dataset: executed ?? (dataset === "auto" ? "company" : dataset),
  };
}

/**
 * Posture → fixed monthly infrastructure fee (cents). The success-fee schedule is baked into
 * the agreement body; only the Infrastructure Fee varies, and it is hardcoded per posture.
 */
export function postureMonthlyFeeCents(templateId: string): number {
  return /acceler/i.test(templateId) ? 5_000_000 : 2_500_000;
}

// ── Bookings (Pipeline surface) ──────────────────────────────────────────────
// Thin passthrough to edge_api's GET /api/v1/bookings (corex.bookings). Operator list
// for the Pipeline tab; the BFF brokers the service token across the auth boundary.

export interface EdgeBookingSummary {
  booking_id: string;
  cal_event_uid: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  domain: string | null;
  title: string | null;
  status: string;
  start_time: string | null;
  created_at: string | null;
}

export async function edgeListBookings(): Promise<EdgeBookingSummary[]> {
  const res = await fetch(`${base()}/api/v1/bookings`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge bookings list failed: ${res.status}`);
  return (await res.json()) as EdgeBookingSummary[];
}

export interface EdgeOpportunitySummary {
  opportunity_id: string;
  status: string;
  created_at: string | null;
  company_name: string | null;
  domain: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  source_booking_id: string | null;
  booked_at: string | null;
}

export async function edgeListOpportunities(): Promise<EdgeOpportunitySummary[]> {
  const res = await fetch(`${base()}/api/v1/opportunities`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge opportunities list failed: ${res.status}`);
  return (await res.json()) as EdgeOpportunitySummary[];
}

// Deals — the first-class pipeline entity (business.deals, one per account) that replaces the
// booking->opportunity projection as the cockpit's Applications/Research list source. Mapped onto
// the existing OpportunitySummary shape by the BFF route (deal_id->opportunityId,
// deal_handle->handle, last_booking_id->sourceBookingId), so the SPA is unchanged.
export interface EdgeDealSummary {
  deal_id: string;
  deal_handle: string;
  status: string;
  created_at: string | null;
  company_name: string | null;
  domain: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  last_booking_id: string | null;
  booked_at: string | null;
}

export async function edgeListDeals(): Promise<EdgeDealSummary[]> {
  const res = await fetch(`${base()}/api/v1/deals`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge deals list failed: ${res.status}`);
  return (await res.json()) as EdgeDealSummary[];
}

export interface EdgeEngagementMappingOption {
  id: string;
  label: string;
  /** Archetype (economic shape) the option's template belongs to — drives the staging form. */
  archetype_key: string | null;
  archetype_name: string | null;
  performance_fee_basis: string | null;
  /** The template's declared Documenso merge fields — the exact inputs the value form renders. */
  text_fields: string[];
}

export async function edgeListEngagementMappings(
  orgDomain: string,
): Promise<EdgeEngagementMappingOption[]> {
  const qs = new URLSearchParams({ org_domain: orgDomain }).toString();
  const res = await fetch(`${base()}/api/v1/engagement-mappings?${qs}`, {
    headers: serviceHeaders(false),
  });
  if (!res.ok) throw new EdgeError(`edge engagement-mappings list failed: ${res.status}`);
  return (await res.json()) as EdgeEngagementMappingOption[];
}

export interface EdgeDocumensoTemplateSummary {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  is_default: boolean;
  archetype_name: string | null;
}

// Every documenso_template for the operator's org (active + archived) — the Manage Templates table.
export async function edgeListDocumensoTemplates(
  orgDomain: string,
): Promise<EdgeDocumensoTemplateSummary[]> {
  const qs = new URLSearchParams({ org_domain: orgDomain }).toString();
  const res = await fetch(`${base()}/api/v1/documenso-templates?${qs}`, {
    headers: serviceHeaders(false),
  });
  if (!res.ok) throw new EdgeError(`edge documenso-templates list failed: ${res.status}`);
  return (await res.json()) as EdgeDocumensoTemplateSummary[];
}

// Mark one template as the org's Confirm & Originate default (active-only, enforced edge-side).
export async function edgeSetDefaultDocumensoTemplate(
  orgDomain: string,
  documensoTemplateId: string,
): Promise<void> {
  const res = await fetch(`${base()}/api/v1/documenso-templates/default`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ org_domain: orgDomain, documenso_template_id: documensoTemplateId }),
  });
  if (!res.ok) throw new EdgeError(`edge documenso-templates set-default failed: ${res.status}`);
}

// ── Documenso template field defaults (the Settings "Documenso Templates" editor) ────────────
// edge_api reads/writes the LIVE Documenso template's fields: list the editable fields (+ current
// defaults), and bake per-field default values onto the template via /envelope/field/update-many.

export interface EdgeDocumensoTemplateField {
  /** The Documenso field id — the key used to write a default. */
  id: number;
  /** TEXT | NUMBER | DROPDOWN — the default-able field types. */
  type: string;
  label: string | null;
  recipient_id: number | null;
  page: number | null;
  /** The value currently baked into the template, if any. */
  default: string | null;
}

/** The editable fields (+ current defaults) of a Documenso template, live from the template. */
export async function edgeListDocumensoTemplateFields(
  documensoTemplateId: string,
): Promise<EdgeDocumensoTemplateField[]> {
  const qs = new URLSearchParams({ documenso_template_id: documensoTemplateId }).toString();
  const res = await fetch(`${base()}/api/v1/documenso-template-fields?${qs}`, {
    headers: serviceHeaders(false),
  });
  if (!res.ok) throw new EdgeError(`edge documenso-template-fields list failed: ${res.status}`);
  return (await res.json()) as EdgeDocumensoTemplateField[];
}

/** Write per-field DEFAULT values onto the live template; returns the refreshed field list. */
export async function edgeSaveDocumensoTemplateDefaults(
  documensoTemplateId: string,
  defaults: { id: number; value: string }[],
): Promise<EdgeDocumensoTemplateField[]> {
  const res = await fetch(`${base()}/api/v1/documenso-template-fields/defaults`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ documenso_template_id: documensoTemplateId, defaults }),
  });
  if (!res.ok)
    throw new EdgeError(
      `edge documenso-template-defaults save failed: ${res.status} ${await res.text()}`,
    );
  return (await res.json()) as EdgeDocumensoTemplateField[];
}

export interface EdgeSignState {
  opportunity_id: string;
  document_id: string;
  /** True iff a terminal DOCUMENT_COMPLETED webhook row has landed for THIS (opportunity, document)
   * pair. */
  signed: boolean;
  /** Most-recent raw event name (UPPERCASE_UNDERSCORE), or null if no rows captured yet. */
  latest_event: string | null;
  /** Envelope-level Documenso status carried in the raw payload (PENDING / COMPLETED / …). */
  status: string | null;
}

/**
 * PUBLIC signing-state read for the prospect poll, keyed by the `(opportunityId, documentId)` PAIR.
 * FULLY OFFLINE on the edge_api side — DERIVED from the RAW webhook capture
 * (business.documenso_webhook_events), ZERO Documenso calls. `signed` requires the pair to match
 * (`external_id = opportunityId AND envelope_id = documentId`), so a guessed numeric document id
 * with a wrong/missing opportunity handle returns signed:false. Drives DocumentSignPage's advance.
 */
export async function edgeGetSignState(
  opportunityId: string,
  documentId: string,
  signer?: "client" | "originator",
): Promise<EdgeSignState | null> {
  // `signer=originator` scopes `signed` to the originator's countersignature (the "Copy your link"
  // path); default = client (the prospect). Mirrors edgeGetSignToken.
  const q = signer === "originator" ? "?signer=originator" : "";
  const res = await fetch(
    `${base()}/api/v1/documenso/sign-state/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}${q}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new EdgeError(`edge sign-state failed: ${res.status}`);
  return (await res.json()) as EdgeSignState;
}

export interface EdgeSignToken {
  signing_token: string | null;
  status: string | null;
  documenso_host: string;
}

/**
 * PUBLIC signing-TOKEN read for the embed load, keyed by the same `(opportunityId, documentId)`
 * pair. edge_api makes ONE live Documenso read (`GET /api/v2/document/{documentId}`) and PAIR-GATES
 * (asserts the document's `externalId == opportunityId`) before returning the recipient token; a
 * mismatched/guessed id → 404 (null here). NOT in the poll loop — called once at embed load.
 */
export async function edgeGetSignToken(
  opportunityId: string,
  documentId: string,
  signer?: "client" | "originator",
): Promise<EdgeSignToken | null> {
  // `signer=originator` selects the originator's token (the "Copy your link" path); default = client.
  const q = signer === "originator" ? "?signer=originator" : "";
  const res = await fetch(
    `${base()}/api/v1/documenso/sign-token/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}${q}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new EdgeError(`edge sign-token failed: ${res.status}`);
  return (await res.json()) as EdgeSignToken;
}

// ── Document payments (direct-to-documenso engagement fee, Stripe ACH) ────────
// PUBLIC, keyed by the same (opportunityId, documentId) pair as signing — edge_api owns the whole
// flow; these are pure pass-throughs. The mint is gated on the document being signed and resolves the
// amount server-side from fee_amount; `paid` advances only via the Stripe webhook.

export interface EdgeDocumentPaymentInit {
  client_secret: string;
  publishable_key: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
  // Optional: an older edge_api during a staggered deploy omits these; the BFF then maps them to
  // undefined and the SPA falls back to empty (no pre-fill), never a crash.
  recipient_name?: string | null;
  recipient_email?: string | null;
}

/** Mint (or reuse) the ACH PaymentIntent for the pair. edge_api 409s until the document is signed
 * (and for "already paid" / no payable fee). The HTTP status is attached to the thrown EdgeError so
 * the route can propagate it verbatim to the SPA. */
export async function edgeCreateDocumentPaymentIntent(
  opportunityId: string,
  documentId: string,
): Promise<EdgeDocumentPaymentInit> {
  const res = await fetch(
    `${base()}/api/v1/documenso/payment-intent/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new EdgeError(detail || `edge document payment-intent failed: ${res.status}`);
    (err as EdgeError & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as EdgeDocumentPaymentInit;
}

export interface EdgeDocumentPaymentState {
  payment_status: string;
  amount_cents: number | null;
  currency: string;
  paid_at: string | null;
  rail: string | null;
}

/** The authoritative payment state for the pair (the poll target). `none` before the first mint and
 * for a pair mismatch. `succeeded` only after the Stripe webhook lands. */
export async function edgeGetDocumentPaymentState(
  opportunityId: string,
  documentId: string,
): Promise<EdgeDocumentPaymentState> {
  const res = await fetch(
    `${base()}/api/v1/documenso/payment/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}`,
  );
  if (!res.ok) throw new EdgeError(`edge document payment state failed: ${res.status}`);
  return (await res.json()) as EdgeDocumentPaymentState;
}

// ── Operator settings (the cockpit Settings tab) ─────────────────────────────
// edge_api owns public.operator_settings behind its service-token gateway; this BFF is a DUMB
// pass-through (validate the session, assert the auth_user_id on the path, forward). Snake_case on the
// wire. Replaces the BFF's prior direct Supabase access — consistent with the rest of the wiring.

export interface EdgeOperatorSettings {
  render_mode: string;
  direct_to_documenso_lane: string;
  stripe_mode: string | null;
  updated_at: string | null;
}

export async function edgeGetOperatorSettings(authUserId: string): Promise<EdgeOperatorSettings> {
  const res = await fetch(`${base()}/api/v1/operator-settings/${encodeURIComponent(authUserId)}`, {
    headers: serviceHeaders(false),
  });
  if (!res.ok) throw new EdgeError(`edge operator-settings read failed: ${res.status}`);
  return (await res.json()) as EdgeOperatorSettings;
}

export async function edgePutOperatorSettings(
  authUserId: string,
  body: { render_mode?: string; direct_to_documenso_lane?: string; stripe_mode?: string },
): Promise<EdgeOperatorSettings> {
  const res = await fetch(`${base()}/api/v1/operator-settings/${encodeURIComponent(authUserId)}`, {
    method: "PUT",
    headers: serviceHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new EdgeError(`edge operator-settings write failed: ${res.status}`);
  return (await res.json()) as EdgeOperatorSettings;
}

// ── Close.com call-sync (the Insights "now dialing" read) ────────────────────
// edge_api derives the operator's current outbound Close call OFFLINE from the raw Close webhook
// events + the lead→domain crosswalk — NOT operator-scoped (one operator; all logins are "me").
// The Insights tab polls the BFF, which brokers this. Service-token gated.

export interface EdgeActiveCall {
  active: boolean;
  close_lead_id?: string | null;
  close_contact_id?: string | null;
  status?: string | null;
  remote_phone?: string | null;
  started_at?: string | null;
  normalized_domain?: string | null;
  company_name?: string | null;
  resolved_contact_id?: string | null;
}

export async function edgeGetActiveCall(): Promise<EdgeActiveCall> {
  const res = await fetch(`${base()}/api/v1/close/active-call`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge active-call read failed: ${res.status}`);
  return (await res.json()) as EdgeActiveCall;
}

export interface EdgeCompanyProfile {
  domain: string;
  company: string | null;
  hq: string | null;
  headcount: string | null;
  est_revenue_range: string | null;
  overview: string | null;
  focus: string[];
  industries: string[];
  geographies: string[];
  source: string | null;
}

export interface EdgeCompanyProfileSnapshot {
  id: number;
  domain: string;
  company: string | null;
  signer_name: string | null;
  title: string | null;
  email: string | null;
  hq: string | null;
  headcount: string | null;
  est_revenue_range: string | null;
  overview: string | null;
  focus: string[];
  industries: string[];
  geographies: string[];
  verified: Record<string, boolean>;
  saved_by: string | null;
  created_at: string | null;
}

export interface EdgeBookingDetail extends EdgeBookingSummary {
  ical_uid: string | null;
  cal_booking_id: number | null;
  event_type_id: number | null;
  end_time: string | null;
  booked_at: string | null;
  updated_at: string | null;
  profile: EdgeCompanyProfile | null;
  /** The operator's latest saved dossier snapshot for this domain (else null). */
  latest_snapshot: EdgeCompanyProfileSnapshot | null;
}

/** One booking by its uuid for the profile page. Returns null on 404. */
export async function edgeGetBooking(id: string): Promise<EdgeBookingDetail | null> {
  const res = await fetch(`${base()}/api/v1/bookings/${encodeURIComponent(id)}`, {
    headers: serviceHeaders(false),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new EdgeError(`edge booking get failed: ${res.status}`);
  return (await res.json()) as EdgeBookingDetail;
}

// ── Company-profile snapshots (the Dossier's "Save Profile") ──────────────────
// Append-only: POST appends one immutable snapshot for a domain. The BFF brokers the operator
// session; the service token rides to edge_api. The read (latest snapshot) flows through the
// booking detail above — no direct DB access on this surface.

export interface EdgeCompanyProfileSnapshotCreate {
  company?: string | null;
  signer_name?: string | null;
  title?: string | null;
  email?: string | null;
  hq?: string | null;
  headcount?: string | null;
  est_revenue_range?: string | null;
  overview?: string | null;
  focus?: string[];
  industries?: string[];
  geographies?: string[];
  verified?: Record<string, boolean>;
  saved_by?: string | null;
}

export async function edgeSaveCompanyProfileSnapshot(
  domain: string,
  body: EdgeCompanyProfileSnapshotCreate,
): Promise<EdgeCompanyProfileSnapshot> {
  const res = await fetch(
    `${base()}/api/v1/company-profiles/${encodeURIComponent(domain)}/snapshots`,
    { method: "POST", headers: serviceHeaders(), body: JSON.stringify(body) },
  );
  if (!res.ok) throw new EdgeError(`edge snapshot save failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as EdgeCompanyProfileSnapshot;
}

// ── Proposal-template authoring (Settings surface) ───────────────────────────
// Thin passthrough to edge_api's /api/v1/proposal-templates/* — the engine owns markdown→HTML,
// DocRaptor preview (→ R2 presigned link), and the publish registry. The BFF only brokers the
// service token across the auth boundary; the operator session is checked in-router.

export interface EdgeTemplateSummary {
  id: string;
  slug: string | null;
  name: string | null;
  status: string;
  monthly_fee_cents: number | null;
  updated_at: string | null;
}

export interface EdgeTemplateRow extends EdgeTemplateSummary {
  markdown: string;
  token_manifest: string[];
  created_by: string | null;
  created_at: string | null;
  published_at: string | null;
}

export interface EdgeTemplateConvertResult {
  html: string;
  detected_tokens: string[];
}

export interface EdgeTemplatePreviewResult {
  pdf_url: string;
  expires_seconds: number;
  detected_tokens: string[];
}

const TEMPLATES = "/api/v1/proposal-templates";

async function edgeTemplateJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, { ...init, headers: serviceHeaders() });
  if (!res.ok)
    throw new EdgeError(`edge template ${init.method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export function edgeTemplateConvert(body: { markdown: string }) {
  return edgeTemplateJson<EdgeTemplateConvertResult>(`${TEMPLATES}/convert`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function edgeTemplatePreview(body: {
  markdown: string;
  token_values: Record<string, string>;
}) {
  return edgeTemplateJson<EdgeTemplatePreviewResult>(`${TEMPLATES}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function edgeTemplateCreate(body: {
  markdown?: string;
  name?: string | null;
  created_by?: string | null;
}) {
  return edgeTemplateJson<EdgeTemplateRow>(TEMPLATES, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function edgeTemplateList(
  publishedOnly = false,
  orgDomain?: string,
): Promise<EdgeTemplateSummary[]> {
  const params = new URLSearchParams();
  if (publishedOnly) params.set("published", "true");
  if (orgDomain) params.set("org_domain", orgDomain);
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`${base()}${TEMPLATES}${qs}`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge template list: ${res.status}`);
  return (await res.json()) as EdgeTemplateSummary[];
}

export function edgeTemplateGet(id: string) {
  return edgeTemplateJson<EdgeTemplateRow>(`${TEMPLATES}/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function edgeTemplateUpdate(id: string, body: { markdown?: string; name?: string | null }) {
  return edgeTemplateJson<EdgeTemplateRow>(`${TEMPLATES}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export interface EdgeTemplatePublishError {
  status: number;
  message: string;
}

export async function edgeTemplatePublish(
  id: string,
  body: { name: string; slug?: string | null; monthly_fee_cents?: number | null },
): Promise<EdgeTemplateRow> {
  const res = await fetch(`${base()}${TEMPLATES}/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    throw new EdgeError(`slug conflict: ${await res.text()}`);
  }
  if (!res.ok) throw new EdgeError(`edge template publish: ${res.status} ${await res.text()}`);
  return (await res.json()) as EdgeTemplateRow;
}

// ── Engagement templates (Settings "Engagement Templates" render surface) ──────────────────────
// A self-contained core-x path: edge_api lists the repo-resident template tree (path/archetype/
// version) and renders one to a clean PDF via DocRaptor (plain by default) → R2 presigned URL.
// NO Documenso — the operator affixes the signature/date/value fields in the editor by hand. This
// BFF only brokers the service token across the auth boundary.

export interface EdgeEngagementTemplate {
  brand: string;
  path: string;
  archetype: string;
  version: string;
  name: string;
  default_style: string;
  styles_available: string[];
  inputs: string[];
}

/** The selectable (path, archetype, version) templates — for the Settings dropdowns. */
export async function edgeListEngagementTemplates(): Promise<EdgeEngagementTemplate[]> {
  const res = await fetch(`${base()}/api/v1/engagement-templates`, {
    headers: serviceHeaders(false),
  });
  if (!res.ok) throw new EdgeError(`edge engagement-templates list failed: ${res.status}`);
  return (await res.json()) as EdgeEngagementTemplate[];
}

export interface EdgeEngagementTemplateRender {
  pdf_url: string;
  expires_seconds: number;
  path: string;
  archetype: string;
  version: string;
  style: string;
  pdf_bytes: number;
}

/** Render the selected template to a clean PDF (plain by default). Service-token gated. No Documenso. */
export async function edgeRenderEngagementTemplate(input: {
  brand: string;
  path: string;
  archetype: string;
  version: string;
  style?: string;
}): Promise<EdgeEngagementTemplateRender> {
  const res = await fetch(`${base()}/api/v1/engagement-templates/render`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new EdgeError(
      `edge engagement-template render failed: ${res.status} ${await res.text()}`,
    );
  return (await res.json()) as EdgeEngagementTemplateRender;
}

export interface EdgeEngagementTemplateRenderPush {
  documenso_template_id: string;
  documenso_numeric_id: number | null;
  brand: string;
  path: string;
  archetype: string;
  version: string;
  style: string;
  source_kind: string;
  pdf_bytes: number;
  pdf_url: string | null;
}

/** Render the selected template AND create a Documenso template from the PDF. Service-token gated.
 *  ``values`` carries the operator inputs a tokenized template bakes in (edge_api derives the rest). */
export async function edgeRenderPushTemplate(input: {
  brand: string;
  path: string;
  archetype: string;
  version: string;
  style?: string;
  values?: { amount: number; introductions: number; term_days: number };
}): Promise<EdgeEngagementTemplateRenderPush> {
  const res = await fetch(`${base()}/api/v1/engagement-templates/render-push`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new EdgeError(
      `edge engagement-template render-push failed: ${res.status} ${await res.text()}`,
    );
  return (await res.json()) as EdgeEngagementTemplateRenderPush;
}
