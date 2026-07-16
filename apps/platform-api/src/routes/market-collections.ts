/**
 * market-collections broker — proxies the Market tab's collection instrument to
 * core-x edge_api's `/api/v1/market-collections/*`: the 22 durable pair-defined
 * market collections (gtm.market_collections; hq/MARKET_COLLECTIONS_PROGRAM.md
 * v2) — list + live member count with geo/band tuning.
 *
 * Same seam as routes/market-spec.ts (requireUser in, service token out, bodies
 * and statuses verbatim).
 *
 *   GET  /            → edge GET  /api/v1/market-collections
 *   POST /count       → edge POST /api/v1/market-collections/count
 */

import { Hono } from "hono";

import { type AuthVariables, requireUser } from "../auth.ts";

const EDGE_API_URL = (process.env.EDGE_API_URL ?? "").replace(/\/$/, "");
const EDGE_API_SERVICE_TOKEN = process.env.EDGE_API_SERVICE_TOKEN ?? "";

const UPSTREAM = "/api/v1/market-collections";

export const marketCollectionsRoutes = new Hono<{ Variables: AuthVariables }>();

marketCollectionsRoutes.use("*", requireUser);

marketCollectionsRoutes.get("/", async (c) => {
  const res = await fetch(`${EDGE_API_URL}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${EDGE_API_SERVICE_TOKEN}` },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

marketCollectionsRoutes.post("/count", async (c) => {
  const body = await c.req.text();
  const res = await fetch(`${EDGE_API_URL}${UPSTREAM}/count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EDGE_API_SERVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(text, { status: res.status, headers: { "content-type": contentType } });
});
