/**
 * market broker — proxies the Market tab (audience builder) to core-x edge_api's
 * audience engine (`/api/v1/audience/*`): cohort entity/people queries, the Close
 * push flow (dry-run + live), and the push-run ledger reads.
 *
 * Trust model (two hops, distinct credentials — same as award-profile.ts):
 *   1. platform-app sends the user's Supabase access_token; `requireUser`
 *      validates it here (end-user identity / app-level auth).
 *   2. The BFF then calls edge_api with the INTERNAL service token
 *      (`EDGE_API_SERVICE_TOKEN`) as Bearer — the user's JWT is NOT forwarded.
 *
 * Routes (all dumb pass-throughs; JSON bodies forward verbatim, upstream
 * status + body return verbatim — the BFF synthesizes nothing):
 *   POST /entities/query  → edge POST /api/v1/audience/entities/query
 *   POST /entities/count  → edge POST /api/v1/audience/entities/count
 *   POST /people/query    → edge POST /api/v1/audience/people/query
 *   POST /push            → edge POST /api/v1/audience/push
 *   GET  /runs/:id        → edge GET  /api/v1/audience/runs/{id}
 *   GET  /runs            → edge GET  /api/v1/audience/runs (query string forwarded)
 */

import { Hono } from "hono";

import { type AuthVariables, requireUser } from "../auth.ts";

// Same env seam as lib/edge.ts — EDGE_API_URL + EDGE_API_SERVICE_TOKEN from
// Doppler `hq-rare-structure-hq` (not in env.ts's zod schema by convention).
const EDGE_API_URL = (process.env.EDGE_API_URL ?? "").replace(/\/$/, "");
const EDGE_API_SERVICE_TOKEN = process.env.EDGE_API_SERVICE_TOKEN ?? "";

const AUDIENCE = "/api/v1/audience";

/** Forward to edge_api and return the upstream status + body verbatim. */
async function forward(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${EDGE_API_URL}${path}`, init);
  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(body, { status: res.status, headers: { "content-type": contentType } });
}

function serviceHeaders(json: boolean): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${EDGE_API_SERVICE_TOKEN}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export const marketRoutes = new Hono<{ Variables: AuthVariables }>();

marketRoutes.use("*", requireUser);

// The four POST surfaces share one shape: JSON body straight through.
const POST_SEGMENTS = ["/entities/query", "/entities/count", "/people/query", "/push"] as const;

for (const segment of POST_SEGMENTS) {
  marketRoutes.post(segment, async (c) => {
    const body = await c.req.text();
    return forward(`${AUDIENCE}${segment}`, {
      method: "POST",
      headers: serviceHeaders(true),
      body,
    });
  });
}

marketRoutes.get("/runs/:id", (c) => {
  const id = c.req.param("id");
  return forward(`${AUDIENCE}/runs/${encodeURIComponent(id)}`, {
    headers: serviceHeaders(false),
  });
});

marketRoutes.get("/runs", (c) => {
  // Pass the query string (e.g. ?limit=20) through; edge_api owns the semantics.
  const qs = new URL(c.req.url).search;
  return forward(`${AUDIENCE}/runs${qs}`, { headers: serviceHeaders(false) });
});
