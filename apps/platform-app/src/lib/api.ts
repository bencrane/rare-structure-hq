/**
 * Thin BFF client. The signed-in SAM.gov opportunity surfaces were retired
 * with data-engine-x; the only remaining call is the public proposal fetch.
 */
import type { ProposalDeal } from "@/routes/proposal/proposal-data";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("platform-app: VITE_API_BASE_URL missing — using same-origin.");
}

/**
 * Public proposal fetch — the capability URL `/proposal/:ref` carries its own
 * credential (the unguessable ref), so this call is intentionally
 * UNAUTHENTICATED (no Supabase bearer).
 *
 * Returns null when no BFF is configured (local dev) or the endpoint is not yet
 * live / the ref is unknown — the proposal route falls back to its bundled
 * fixture in that case. The backend endpoint `GET /api/v1/proposals/:ref` lands
 * in the Anvil wiring phase and is expected to return the { data } envelope.
 */
export async function getProposal(ref: string): Promise<ProposalDeal | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as ProposalDeal;
  } catch {
    return null;
  }
}

// ────────────── Anvil embedded e-sign (public, ref-scoped) ──────────────

export interface ProposalPacket {
  etchPacketEid: string;
  documentGroupEid: string;
  signerEid: string;
}

/**
 * Create the Anvil Etch packet for a proposal; returns the embedded signer's
 * eid. Public (no bearer) — the ref is the capability. The Anvil API key stays
 * on the BFF; the browser only ever sees the signerEid and the sign URL.
 */
export async function createProposalPacket(
  ref: string,
  signer: { signerName: string; signerEmail?: string; signerTitle?: string },
): Promise<ProposalPacket> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/packet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signer),
  });
  if (!res.ok) throw new Error(`packet failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ProposalPacket;
}

/** Mint the short-lived embedded signing URL for a signer from /packet. */
export async function getProposalSignUrl(ref: string, signerEid: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${encodeURIComponent(ref)}/sign-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signerEid }),
  });
  if (!res.ok) throw new Error(`sign-url failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data.url as string;
}
