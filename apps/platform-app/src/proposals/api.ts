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

export interface MandateDraftConfirmed {
  envelopeId: string;
  signingToken: string | null;
  documensoHost: string;
}

/** Direct-to-documenso "Confirm & originate": instantiate a Documenso document from the draft's
 * template and get back the prospect signer token + envelope id (the prospect-link capability). */
export async function confirmMandateDraft(
  token: string,
  id: string,
): Promise<MandateDraftConfirmed> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandate-drafts/${encodeURIComponent(id)}/confirm`,
    { method: "POST", headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`confirm mandate failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as MandateDraftConfirmed;
}

export interface MandateDraftDocument {
  signingToken: string | null;
  documensoHost: string;
  status: string | null;
}

/** PUBLIC prospect read for `/p/m/:envelopeId` — the signer token + host that drive the embed.
 * The envelope id is the capability (no auth). Returns null on 404. */
export async function getMandateDraftDocument(
  envelopeId: string,
): Promise<MandateDraftDocument | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandate-drafts/document/${encodeURIComponent(envelopeId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mandate document failed: ${res.status}`);
  return (await res.json()).data as MandateDraftDocument;
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
