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
  ConfirmProposalInput,
  ConfirmProposalResult,
  CreateProposalInput,
  CreateProposalResult,
  PaymentInit,
  PaymentState,
  ProposalShell,
  ProposalSummary,
  ProposalTemplateMeta,
  SaveCompanyProfileSnapshotInput,
} from "@rare-structure-hq/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** The operator's recent proposals (most recent first) for the cockpit tab. */
export async function listProposals(token: string): Promise<ProposalSummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/proposals`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ProposalSummary[];
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

/** Direct-to-documenso Originate: stamp (opportunity, documenso template) into
 * `business.engagement_mandate_draft_content`. Returns the new draft id. */
export async function createMandateDraft(
  token: string,
  input: { opportunityId: string; documensoTemplateId: string },
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/api/v1/engagement-mandate-drafts`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`mandate draft failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as { id: string };
}

export interface MandatePrefilledOriginated {
  envelopeId: string;
  signingToken: string | null;
  documensoHost: string;
  /** The Documenso document id (numeric) — the disambiguator in the signing link, behind the UUID. */
  documentId: number | null;
  /** The opportunity UUID (the envelope's externalId) — the unguessable prospect-link capability.
   * The link is `/p/m/{opportunityId}/{documentId}`. */
  opportunityId: string;
  /** "pending" for this lane — the document is distributed (no email) so it is signable. */
  status: string;
}

/** Direct-to-documenso "Confirm & originate" — the PREFILL-DOCUMENT-FROM-TEMPLATE lane. Instantiates
 * a Documenso document from the draft's template via /api/v2/template/use, prefilled from
 * opportunity_specific_content, then distribute(NONE) → PENDING. Returns the envelope id + signer
 * token + the opportunity/document pair (the prospect-link capability). */
export async function originatePrefilled(
  token: string,
  id: string,
): Promise<MandatePrefilledOriginated> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandate-drafts/${encodeURIComponent(id)}/originate-prefilled`,
    { method: "POST", headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`originate prefilled failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as MandatePrefilledOriginated;
}

export interface MandateEmbedTemplateOriginated {
  /** The reusable Documenso DIRECT-TEMPLATE token (the EmbedDirectTemplate `token` prop). Mints NO
   * document — Documenso creates the document when the signer completes the embed. */
  directToken: string;
  documensoHost: string;
  /** `${documensoHost}/embed/direct/${directToken}` — the raw Documenso embed URL (informational). */
  embedUrl: string;
  /** The opportunity's 8-char public handle — the unguessable prospect-link capability + externalId. */
  externalId: string;
  /** Same 8-char handle as externalId; the prospect-link path is `/p/t/{opportunityId}/{directToken}`. */
  opportunityId: string;
  directRecipientId: number | null;
  recipientEmail: string | null;
  recipientName: string | null;
  /** "ready" for this lane — the direct-template token is live and self-serve signable. */
  status: string;
}

/** Direct-to-documenso "Confirm & originate" — the EMBED-TEMPLATE lane (the embed-template analog of
 * `originatePrefilled`). Mints NO document — returns the reusable Documenso DIRECT-TEMPLATE token; the
 * signer self-identifies in an EmbedDirectTemplate and Documenso creates the document on completion
 * (source=TEMPLATE_DIRECT_LINK). `directRecipientId` is optional. */
export async function originateEmbedTemplate(
  token: string,
  id: string,
  directRecipientId?: number | null,
): Promise<MandateEmbedTemplateOriginated> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandate-drafts/${encodeURIComponent(id)}/originate-embed-template`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ directRecipientId: directRecipientId ?? null }),
    },
  );
  if (!res.ok)
    throw new Error(`originate embed template failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as MandateEmbedTemplateOriginated;
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
): Promise<MandateSignState | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/documenso/sign/${encodeURIComponent(opportunityId)}/${encodeURIComponent(documentId)}/state`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mandate sign state failed: ${res.status}`);
  return (await res.json()).data as MandateSignState;
}

/** Instantiate a proposal record → its capability ref + shell path. */
export async function createProposal(
  token: string,
  input: CreateProposalInput,
): Promise<CreateProposalResult> {
  const res = await fetch(`${API_BASE}/api/v1/proposals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as CreateProposalResult;
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

/**
 * Originate from the mandate editor ("Confirm & originate"): STAMP the locked-in structured values
 * onto the instance → render the PDF + create the signing envelope. Returns the originate result
 * (incl. the live signing token). Throws on 409 (already originated) and other failures.
 */
/** Thrown when confirm hits 409 — the proposal is already originated (envelope exists, immutable). */
export class AlreadyOriginatedError extends Error {
  constructor() {
    super("This mandate is already originated.");
    this.name = "AlreadyOriginatedError";
  }
}

export async function confirmProposal(
  token: string,
  ref: string,
  input: ConfirmProposalInput,
): Promise<ConfirmProposalResult> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/confirm`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  // 409 = already originated — a terminal "ready" state, never a retry-able failure.
  if (res.status === 409) throw new AlreadyOriginatedError();
  if (!res.ok) throw new Error(`confirm failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ConfirmProposalResult;
}

/** Email the shell link to the proposal's client (operator-only). */
export async function sendProposal(
  token: string,
  ref: string,
): Promise<{ sent: boolean; id?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/send`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`send failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as { sent: boolean; id?: string };
}

// ── Public client-shell calls (the ref is the capability — no auth) ──────────

/** Fetch the lean shell projection for `/p/:ref`. Returns null when unknown. */
export async function getProposalShell(ref: string): Promise<ProposalShell | null> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`shell failed: ${res.status}`);
  return (await res.json()).data as ProposalShell;
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

/**
 * Mint (or reuse) the ACH PaymentIntent for `/p/:ref/pay`. Returns the client_secret + publishable
 * key for Stripe Elements. Throws PaymentError(409) until the agreement is signed. The amount is
 * resolved server-side from the proposal — the browser never sends one.
 */
export async function createPaymentIntent(ref: string): Promise<PaymentInit> {
  const res = await fetch(
    `${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/payment-intent`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PaymentError(res.status, body || res.statusText);
  }
  return (await res.json()).data as PaymentInit;
}

/** Poll the authoritative (webhook-driven) payment state — ACH settles after the browser hands off. */
export async function getPaymentState(ref: string): Promise<PaymentState | null> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/payment`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`payment state failed: ${res.status}`);
  return (await res.json()).data as PaymentState;
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
