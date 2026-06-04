/**
 * Thin BFF client for /api/v1/sam-opps/*. Pulls the current Supabase
 * access_token off the session at call-time so refreshes are picked up
 * automatically.
 */
import { supabase } from "./supabase";

import type { ProposalDeal } from "@/routes/proposal/proposal-data";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("platform-app: VITE_API_BASE_URL missing — using same-origin.");
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return `Bearer ${token}`;
}

// ────────────── Types — mirror DEX shapes minimally ──────────────

export interface OppRow {
  notice_id: string;
  title: string | null;
  notice_type: string | null;
  posted_date: string | null;
  response_deadline: string | null;
  department_agency: string | null;
  sub_tier: string | null;
  office: string | null;
  naics_code: string | null;
  set_aside_code: string | null;
  pop_state: string | null;
  pop_city: string | null;
  pop_country: string | null;
  active_flag: string | null;
  link: string | null;
  // detail-only fields are sparse on list rows; the detail call returns them.
  [k: string]: unknown;
}

export interface SearchResult {
  total_matched: number;
  rows: OppRow[];
}

export interface SearchFilters {
  naics_code?: string;
  naics_prefix?: string;
  set_aside_code?: string;
  pop_state?: string;
  posted_date_gte?: string;
  posted_date_lte?: string;
  response_deadline_gte?: string;
  response_deadline_lte?: string;
  department_agency?: string;
  notice_type?: string;
  active_flag?: string;
  limit?: number;
  offset?: number;
}

export interface StatsRow {
  value: string | null;
  count: number;
}

// ────────────── Calls ──────────────

export async function searchOpps(filters: SearchFilters): Promise<SearchResult> {
  const res = await fetch(`${API_BASE}/api/v1/sam-opps/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await bearer(),
    },
    body: JSON.stringify(filters),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // DEX wraps in { data: ... }
  return json.data as SearchResult;
}

export async function getOppDetail(noticeId: string): Promise<OppRow> {
  const res = await fetch(`${API_BASE}/api/v1/sam-opps/${encodeURIComponent(noticeId)}`, {
    headers: { Authorization: await bearer() },
  });
  if (!res.ok) throw new Error(`detail failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data as OppRow;
}

export async function statsOpps(
  dimension: "naics_code" | "department_agency" | "notice_type" | "set_aside_code" | "pop_state",
  filters: SearchFilters = {},
): Promise<StatsRow[]> {
  const res = await fetch(`${API_BASE}/api/v1/sam-opps/stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await bearer(),
    },
    body: JSON.stringify({ ...filters, dimension }),
  });
  if (!res.ok) throw new Error(`stats failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data as StatsRow[];
}

/**
 * Public proposal fetch — the capability URL `/proposal/:ref` carries its own
 * credential (the unguessable ref), so this call is intentionally
 * UNAUTHENTICATED (no Supabase bearer, unlike the sam-opps calls above).
 *
 * Returns null when no BFF is configured (local dev) or the endpoint is not yet
 * live / the ref is unknown — the proposal route falls back to its bundled
 * fixture in that case. The backend endpoint `GET /api/v1/proposals/:ref` lands
 * in the Anvil wiring phase and is expected to return the DEX-style { data }
 * envelope.
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
