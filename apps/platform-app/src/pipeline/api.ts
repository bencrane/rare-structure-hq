/**
 * Operator-facing bookings client — the Pipeline tab's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF
 * validates it (requireUser) then brokers the read to core-x edge_api
 * (`corex.bookings`). Mirrors the proposals client's auth shape.
 */
import type { BookingDetail, BookingSummary, OpportunitySummary } from "@rare-structure-hq/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** The operator's recent bookings (most recent first) for the Pipeline tab. */
export async function listBookings(token: string): Promise<BookingSummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/bookings`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`bookings failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as BookingSummary[];
}

/** The operator's pipeline opportunities (most recent first) for the Pipeline tab. */
export async function listOpportunities(token: string): Promise<OpportunitySummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/opportunities`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`opportunities failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as OpportunitySummary[];
}

/** One booking by id — the booking-profile page's data source. */
export async function getBooking(token: string, id: string): Promise<BookingDetail> {
  const res = await fetch(`${API_BASE}/api/v1/bookings/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`booking failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as BookingDetail;
}

// ── Engagement mandates (the PARALLEL AO term-only HTML → DocRaptor pathway) ──────────────────
// The Applications "lock the price + term" action: pick a preset package → the BFF brokers it to
// edge_api, which binds the opportunity + package into the static AO HTML and renders a plain PDF
// via DocRaptor (through a Trigger.dev task). Distinct from the staging-draft → Documenso path.

export interface EngagementPackage {
  key: string;
  label: string;
  term_fee_cents: number;
  duration_months: number;
}

/** Preset price+term options for the Applications action dropdown. */
export async function listEngagementPackages(token: string): Promise<EngagementPackage[]> {
  const res = await fetch(`${API_BASE}/api/v1/engagement-mandates/packages`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`packages failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementPackage[];
}

export interface MandateGenerated {
  opportunity_id: string;
  mandate_id: string;
  status: string;
  package_key: string;
  run_id: string | null;
}

/** Lock a package on an opportunity and enqueue its mandate render. */
export async function generateMandate(
  token: string,
  opportunityId: string,
  packageKey: string,
): Promise<MandateGenerated> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandates/${encodeURIComponent(opportunityId)}`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({ packageKey }) },
  );
  if (!res.ok) throw new Error(`stage mandate failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as MandateGenerated;
}

export interface MandateState {
  id: string;
  status: string;
  package_key: string;
  term_fee_cents: number;
  duration_months: number;
  pdf_bytes: number | null;
  error: string | null;
}

/** The opportunity's current mandate state (null when nothing staged yet). */
export async function getMandate(
  token: string,
  opportunityId: string,
): Promise<MandateState | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/engagement-mandates/${encodeURIComponent(opportunityId)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`mandate state failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as MandateState | null;
}
