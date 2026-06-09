/**
 * Operator-facing bookings client — the Pipeline tab's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF
 * validates it (requireUser) then brokers the read to core-x edge_api
 * (`corex.bookings`). Mirrors the proposals client's auth shape.
 */
import type { BookingSummary } from "@rare-structure-hq/shared";

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
