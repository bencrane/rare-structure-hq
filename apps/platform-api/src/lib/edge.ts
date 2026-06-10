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

/**
 * Posture → fixed monthly infrastructure fee (cents). The success-fee schedule is baked into
 * the agreement body; only the Infrastructure Fee varies, and it is hardcoded per posture.
 */
export function postureMonthlyFeeCents(templateId: string): number {
  return /acceler/i.test(templateId) ? 5_000_000 : 2_500_000;
}

export interface EdgeCreateInput {
  clientName: string;
  clientSignerName: string;
  clientEmail: string;
  clientTitle?: string;
  monthlyFeeCents: number;
  /** Published-template slug the operator selected; the engine resolves its body + fee. */
  templateId?: string;
}

export interface EdgeCreateResult {
  ref: string;
  path: string;
  status: string;
  provisioned: boolean;
  provision_error: string | null;
}

/** Raised on a 409 from confirm — the proposal already has an envelope (already originated). */
export class EdgeAlreadyOriginated extends EdgeError {}

export interface EdgeConfirmInput {
  monthly_fee_cents?: number;
  duration_months?: number;
  billing_cadence?: string;
  success_fee_schedule?: { tier: string; rate: string }[];
  effective_date?: string;
}

export interface EdgeConfirmResult {
  ref: string;
  status: string;
  provisioned: boolean;
  provision_error: string | null;
  signing_token: string | null;
}

/**
 * Originate: stamp the operator's locked-in values onto the draft, render the PDF + create the
 * envelope. 409 → already originated (immutable). Service-token gated.
 */
export async function edgeConfirmProposal(
  ref: string,
  input: EdgeConfirmInput,
): Promise<EdgeConfirmResult> {
  const res = await fetch(`${base()}/api/v1/proposals/${encodeURIComponent(ref)}/confirm`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(input),
  });
  if (res.status === 409) throw new EdgeAlreadyOriginated(`proposal already originated: ${ref}`);
  if (!res.ok) throw new EdgeError(`edge confirm failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as EdgeConfirmResult;
}

export async function edgeCreateProposal(input: EdgeCreateInput): Promise<EdgeCreateResult> {
  const res = await fetch(`${base()}/api/v1/proposals`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      template_id: input.templateId ?? null,
      client_name: input.clientName,
      client_signer_name: input.clientSignerName,
      client_email: input.clientEmail,
      client_title: input.clientTitle ?? null,
      monthly_fee_cents: input.monthlyFeeCents,
    }),
  });
  if (!res.ok) throw new EdgeError(`edge create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as EdgeCreateResult;
}

export interface EdgeProposalPublic {
  ref: string;
  status: string;
  template_label: string;
  /** Engagement-page blurb, resolved by the engine from the proposal's template (read-time). */
  exec_summary: string;
  client: { name: string; signer_name: string; title: string | null };
  effective_date: string;
  monthly_fee: string;
  monthly_fee_cents: number;
  duration_months: number;
  billing_cadence: string;
  total: string;
  quarterly_total: string; // legacy alias of total (kept for back-compat)
  success_fee_tiers: { tier: string; rate: string }[];
  signing_token: string | null;
  signed_pdf_url: string | null;
  created_at: string | null;
  /** Stripe ACH payment state ('none' until a PaymentIntent exists; 'succeeded' once funds settle). */
  payment_status?: string;
}

export async function edgeGetProposal(ref: string): Promise<EdgeProposalPublic | null> {
  const res = await fetch(`${base()}/api/v1/proposals/${encodeURIComponent(ref)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new EdgeError(`edge shell failed: ${res.status}`);
  return (await res.json()) as EdgeProposalPublic;
}

export interface EdgeProposalSummary {
  ref: string;
  client_name: string;
  client_signer_name: string;
  status: string;
  monthly_fee: string;
  created_at: string | null;
}

export async function edgeListProposals(): Promise<EdgeProposalSummary[]> {
  const res = await fetch(`${base()}/api/v1/proposals`, { headers: serviceHeaders(false) });
  if (!res.ok) throw new EdgeError(`edge list failed: ${res.status}`);
  return (await res.json()) as EdgeProposalSummary[];
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
  apply_brand: boolean;
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

export function edgeTemplateConvert(body: { markdown: string; apply_brand: boolean }) {
  return edgeTemplateJson<EdgeTemplateConvertResult>(`${TEMPLATES}/convert`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function edgeTemplatePreview(body: {
  markdown: string;
  apply_brand: boolean;
  token_values: Record<string, string>;
}) {
  return edgeTemplateJson<EdgeTemplatePreviewResult>(`${TEMPLATES}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function edgeTemplateCreate(body: {
  markdown?: string;
  apply_brand?: boolean;
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

export function edgeTemplateUpdate(
  id: string,
  body: { markdown?: string; apply_brand?: boolean; name?: string | null },
) {
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

// ── Payments (public, ACH) — the ref is the capability, no service token ─────────────────────
// edge_api owns the Stripe surface: it mints/reuses the PaymentIntent (amount resolved server-side
// from the proposal content) and verifies the webhook. This BFF only brokers the public ref
// endpoints; the Stripe SECRET key never leaves core-x. The publishable key + client_secret flow
// through to the browser (both are safe to expose by design).

export interface EdgePaymentInit {
  client_secret: string;
  publishable_key: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
}

export interface EdgePaymentState {
  payment_status: string;
  amount_cents: number | null;
  currency: string;
  paid_at: string | null;
}

/** Raised when the agreement is not yet signed (edge_api 409). The pay page maps it to a prompt. */
export class EdgePaymentNotReady extends EdgeError {}

/** Mint (or reuse) the ACH PaymentIntent. edge_api resolves the amount; we never send one. */
export async function edgeCreatePaymentIntent(ref: string): Promise<EdgePaymentInit> {
  const res = await fetch(`${base()}/api/v1/proposals/${encodeURIComponent(ref)}/payment-intent`, {
    method: "POST",
  });
  if (res.status === 409) throw new EdgePaymentNotReady("agreement not yet signed");
  if (!res.ok) throw new EdgeError(`edge payment-intent failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as EdgePaymentInit;
}

/** The authoritative (webhook-driven) payment state. Returns null on 404. */
export async function edgeGetPayment(ref: string): Promise<EdgePaymentState | null> {
  const res = await fetch(`${base()}/api/v1/proposals/${encodeURIComponent(ref)}/payment`);
  if (res.status === 404) return null;
  if (!res.ok) throw new EdgeError(`edge payment state failed: ${res.status}`);
  return (await res.json()) as EdgePaymentState;
}
