/**
 * Operator-facing proposal client.
 *
 * These calls are AUTHENTICATED — only a signed-in operator may list postures
 * or instantiate proposals. The Supabase session access_token is passed as a
 * Bearer; the BFF validates it (requireUser) before touching the store. The
 * public client shell (`/p/:ref`) uses a separate unauthenticated fetch.
 */
import type {
  CreateProposalInput,
  CreateProposalResult,
  ProposalTemplateMeta,
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
