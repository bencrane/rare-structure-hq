/**
 * edge_api client — the core-x engagement-proposal + Documenso v2 e-signature engine.
 *
 * The proposal/signing engine (render → DocRaptor → Documenso → webhook) lives in
 * core-x `apps/edge_api`. This BFF delegates to it across two trust boundaries:
 *   - CREATE / LIST  → service-token (`Authorization: Bearer ${EDGE_API_SERVICE_TOKEN}`)
 *   - PUBLIC ref read → unauthenticated (the proposal `ref` is the capability)
 *
 * The Anvil path (`lib/anvil.ts`, `routes/proposals.ts` sign-session, `webhooks-anvil`)
 * is left intact and unused by the new flow — swap first, delete later.
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
    throw new EdgeError("EDGE_API_URL is not set (Doppler hq-rare-structure-hq → edge_api base URL)");
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
}

export interface EdgeCreateResult {
  ref: string;
  path: string;
  status: string;
  provisioned: boolean;
  provision_error: string | null;
}

export async function edgeCreateProposal(input: EdgeCreateInput): Promise<EdgeCreateResult> {
  const res = await fetch(`${base()}/api/v1/proposals`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
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
  client: { name: string; signer_name: string; title: string | null };
  effective_date: string;
  monthly_fee: string;
  quarterly_total: string;
  success_fee_tiers: { tier: string; rate: string }[];
  signing_token: string | null;
  signed_pdf_url: string | null;
  created_at: string | null;
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
