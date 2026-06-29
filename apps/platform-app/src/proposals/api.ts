/**
 * Operator-facing proposal client.
 *
 * These calls are AUTHENTICATED — only a signed-in operator may list postures
 * or instantiate proposals. The Supabase session access_token is passed as a
 * Bearer; the BFF validates it (requireUser) before touching the store. The
 * public client shell (`/p/:ref`) uses a separate unauthenticated fetch.
 */
import type {
  CompanyProfileSnapshot,
  ProposalTemplateMeta,
  SaveCompanyProfileSnapshotInput,
} from "@rare-structure-hq/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** The non-revealing posture catalog the operator picks from. */
export async function listTemplates(token: string): Promise<ProposalTemplateMeta[]> {
  const res = await fetch(`${API_BASE}/api/v1/proposal-templates`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`templates failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ProposalTemplateMeta[];
}

/** The operator's prospect-facing engagement options — VISIBLE mappings scoped to the operator's
 * org domain (`business.engagement_documenso_template_mappings`). The Dossier picker's source. */
export async function listEngagementMappings(token: string): Promise<ProposalTemplateMeta[]> {
  const res = await fetch(`${API_BASE}/api/v1/engagement-mappings`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`engagement mappings failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ProposalTemplateMeta[];
}

export interface MandateSignToken {
  signingToken: string | null;
  documensoHost: string;
  status: string | null;
}

/** PUBLIC embed-load TOKEN read for `/p/m/:opportunityId/:documentId` — the signer token + host
 * that drive the embed. ONE-TIME (not in the poll loop): edge_api makes one live Documenso read and
 * PAIR-GATES (the document's externalId must equal opportunityId) before returning the token. The
 * opportunity UUID is the capability; a guessed document id under a wrong UUID → 404 (null). */
export async function getMandateSignToken(
  opportunityId: string,
  documentId: string,
  signer?: "originator",
): Promise<MandateSignToken | null> {
  // `signer=originator` (the operator's own "Copy your link") → the originator's token; default = prospect.
  const q = signer === "originator" ? "?signer=originator" : "";
  const res = await fetch(
    `${API_BASE}/api/v1/documenso/sign/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}/token${q}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mandate sign token failed: ${res.status}`);
  return (await res.json()).data as MandateSignToken;
}

export interface MandateSignState {
  opportunityId: string;
  documentId: string;
  /** True once a terminal DOCUMENT_COMPLETED webhook has landed for THIS pair — signing is done. */
  signed: boolean;
  /** Most-recent raw Documenso event name (UPPERCASE_UNDERSCORE), or null if none yet. */
  latestEvent: string | null;
  /** Envelope-level Documenso status from the raw payload (PENDING / COMPLETED / …). */
  status: string | null;
}

/** PUBLIC signing-state POLL for `/p/m/:opportunityId/:documentId` — server-truth, derived FULLY
 * OFFLINE from the raw Documenso webhook capture (ZERO Documenso calls, NOT a browser
 * `onDocumentCompleted` listener). `signed` requires the (opportunity, document) PAIR to match.
 * DocumentSignPage polls this while the embed is shown and advances when `signed` flips true.
 * Returns null on 404. */
export async function getMandateSignState(
  opportunityId: string,
  documentId: string,
  signer?: "originator",
): Promise<MandateSignState | null> {
  // `signer=originator` scopes `signed` to the operator's own countersignature (the "Copy your link"
  // poll) so it advances only once YOU sign; default = prospect. Mirrors getMandateSignToken.
  const q = signer === "originator" ? "?signer=originator" : "";
  const res = await fetch(
    `${API_BASE}/api/v1/documenso/sign/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}/state${q}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mandate sign state failed: ${res.status}`);
  return (await res.json()).data as MandateSignState;
}

/**
 * Append the verified dossier as an immutable snapshot (the Dossier's "Save Profile"). Keyed by
 * `domain` — each call adds a new timestamped row; nothing is overwritten. Returns the saved row.
 */
export async function saveDossierSnapshot(
  token: string,
  domain: string,
  input: SaveCompanyProfileSnapshotInput,
): Promise<CompanyProfileSnapshot> {
  const res = await fetch(
    `${API_BASE}/api/v1/company-profiles/${encodeURIComponent(domain)}/snapshots`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) },
  );
  if (!res.ok) throw new Error(`save failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as CompanyProfileSnapshot;
}

/** Status-carrying error so the pay page can distinguish 409 (unsigned) from other failures. */
export class PaymentError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "PaymentError";
  }
}

// ── Document payments (direct-to-documenso engagement fee) — keyed by the (opportunity, document)
// pair, NOT a proposal ref. PUBLIC (the pair is the capability); edge_api owns the flow, the BFF
// passes through. ────────────────────────────────────────────────────────────────────────────────

export interface DocumentPaymentInit {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
  paymentStatus: string;
  /** Opportunity contact, to pre-fill the editable name/email on the pay page. Null when unavailable. */
  contactName?: string | null;
  contactEmail?: string | null;
}

/** Mint (or reuse) the ACH PaymentIntent for `/p/m/:opportunityId/:documentId/pay`. Throws
 * PaymentError(409) until the document is signed (the gate). The amount is resolved server-side from
 * fee_amount — the browser never sends one. */
export async function createDocumentPaymentIntent(
  opportunityId: string,
  documentId: string,
): Promise<DocumentPaymentInit> {
  const res = await fetch(
    `${API_BASE}/api/v1/documenso/sign/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}/payment-intent`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PaymentError(res.status, body || res.statusText);
  }
  return (await res.json()).data as DocumentPaymentInit;
}

export interface DocumentPaymentState {
  paymentStatus: string;
  amountCents: number | null;
  currency: string;
  paidAt: string | null;
  /** Settled rail ("card" | "us_bank_account"), stamped by the webhook; null until settlement.
   * Cosmetic — tailors the paid-state copy only. */
  rail?: string | null;
}

/** Poll the authoritative (webhook-driven) document payment state. `paymentStatus === "succeeded"` is
 * the settled truth (ACH settles after the browser hands off). Returns null on 404. */
export async function getDocumentPaymentState(
  opportunityId: string,
  documentId: string,
): Promise<DocumentPaymentState | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/documenso/sign/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}/payment`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`document payment state failed: ${res.status}`);
  return (await res.json()).data as DocumentPaymentState;
}
