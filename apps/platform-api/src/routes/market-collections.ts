/**
 * market-collections broker — proxies the Market tab's collection instrument to
 * core-x edge_api's `/api/v1/market-collections/*`: the 22 durable pair-defined
 * market collections (gtm.market_collections; hq/MARKET_COLLECTIONS_PROGRAM.md
 * v2) — list + live member count with geo/band tuning.
 *
 * PUBLIC routes (no requireUser) — same convention as /api/v1/federal/*: the
 * responses carry only public-procurement aggregates and the collection
 * registry (names/descriptions/pair counts), nothing account- or
 * contact-scoped. Public is also what makes the tab work under the dev mock
 * session. Service token still gates the edge upstream.
 *
 *   GET  /            → edge GET  /api/v1/market-collections
 *   POST /count       → edge POST /api/v1/market-collections/count
 */

import { Hono } from "hono";

const EDGE_API_URL = (process.env.EDGE_API_URL ?? "").replace(/\/$/, "");
const EDGE_API_SERVICE_TOKEN = process.env.EDGE_API_SERVICE_TOKEN ?? "";

const UPSTREAM = "/api/v1/market-collections";

export const marketCollectionsRoutes = new Hono();

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
