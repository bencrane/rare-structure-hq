/**
 * Insights API — the live call read the cockpit polls.
 *
 * Mirrors src/pipeline/api.ts: VITE_API_BASE_URL base + the Supabase session JWT as a bearer.
 * The BFF brokers this to edge_api, which derives the current Close call offline. `{ data }` envelope.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export interface ActiveCall {
  active: boolean;
  companyName: string | null;
  normalizedDomain: string | null;
  status: string | null;
  remotePhone: string | null;
  startedAt: string | null;
  closeLeadId: string | null;
  resolvedContactId: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function getActiveCall(token: string): Promise<ActiveCall> {
  const res = await fetch(`${API_BASE}/api/v1/insights/active-call`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`active-call failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as ActiveCall;
}
