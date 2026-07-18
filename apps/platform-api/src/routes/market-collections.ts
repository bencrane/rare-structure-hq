/**
 * market-collections broker — proxies the Market tab's collection instrument to
 * core-x catalyst_api's `/api/v1/market-collections/*` (relocated from edge_api, core-x #1181): the 22 durable pair-defined
 * market collections (gtm.market_collections; hq/MARKET_COLLECTIONS_PROGRAM.md
 * v2) — list + live member count with geo/band tuning.
 *
 * PUBLIC routes (no requireUser) — same convention as /api/v1/federal/*: the
 * responses carry only public-procurement aggregates and the collection
 * registry (names/descriptions/pair counts), nothing account- or
 * contact-scoped. Public is also what makes the tab work under the dev mock
 * session. CATALYST_API_TOKEN gates the upstream.
 *
 *   GET  /            → catalyst GET  /api/v1/market-collections
 *   POST /count       → catalyst POST /api/v1/market-collections/count
 */

import { Hono } from "hono";

import { env } from "../env.ts";

// Catalyst seam — zod-validated fail-fast at boot in env.ts.
const CATALYST_API_URL = env.CATALYST_API_URL;
const CATALYST_API_TOKEN = env.CATALYST_API_TOKEN;

const UPSTREAM = "/api/v1/market-collections";

export const marketCollectionsRoutes = new Hono();

marketCollectionsRoutes.get("/", async (c) => {
  const res = await fetch(`${CATALYST_API_URL}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${CATALYST_API_TOKEN}` },
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
  const res = await fetch(`${CATALYST_API_URL}${UPSTREAM}/count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CATALYST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(text, { status: res.status, headers: { "content-type": contentType } });
});
