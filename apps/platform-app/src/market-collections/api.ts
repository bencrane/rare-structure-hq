/**
 * Market-collections API — client for the durable market-collection instrument.
 *
 * The 22 pair-defined collections (authority: gtm.market_collections;
 * hq/MARKET_COLLECTIONS_PROGRAM.md v2) served via the BFF broker
 * (platform-api routes/market-collections.ts) → core-x edge_api
 * /api/v1/market-collections/*.
 *
 * Member definition (fixed, matches the viewer's Bucket Explorer):
 * won FY23–25 within the selected collections' pairs in [min, max) AND ≥1
 * active in-scope prime award — PoP-filtered by working_in when given (the
 * PoP filter rides on the ACTIVE award, never on aggregate history).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type Collection = {
  slug: string;
  title: string;
  description: string;
  pair_count: number;
};

export type CollectionsCountRequest = {
  collections: string[];
  based_in?: string[];
  working_in?: string[];
  min_won?: number;
  max_won?: number;
};

export type CollectionsCount = {
  count: number;
  won_total: number;
  won_median: number;
  won_avg: number;
  spec: Record<string, unknown>;
  elapsed_ms: number | null;
  artifact: string | null;
};

async function parseError(res: Response): Promise<Error> {
  let detail = await res.text();
  try {
    detail = (JSON.parse(detail) as { detail?: string }).detail ?? detail;
  } catch {
    // non-JSON error body — surface verbatim
  }
  return new Error(detail || `market-collections request failed: ${res.status}`);
}

export async function listCollections(token: string): Promise<Collection[]> {
  const res = await fetch(`${API_BASE}/api/v1/market-collections/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as { collections: Collection[] };
  return payload.collections;
}

export async function countCollections(
  token: string,
  req: CollectionsCountRequest,
): Promise<CollectionsCount> {
  const res = await fetch(`${API_BASE}/api/v1/market-collections/count`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CollectionsCount;
}
