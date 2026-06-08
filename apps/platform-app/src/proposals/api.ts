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
  ProposalShell,
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

// ── Public client-shell calls (the ref is the capability — no auth) ──────────

/** Fetch the lean shell projection for `/p/:ref`. Returns null when unknown. */
export async function getProposalShell(ref: string): Promise<ProposalShell | null> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`shell failed: ${res.status}`);
  return (await res.json()).data as ProposalShell;
}

/** Mint a fresh embedded sign URL for this proposal (record-aware, server-side). */
export async function startSignSession(ref: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/sign-session`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`sign-session failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data.url as string;
}
