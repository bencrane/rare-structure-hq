/**
 * market-spec broker — proxies the Market tab's market-spec instrument to
 * core-x edge_api's spec engine (`/api/v1/market-spec/*`): the live
 * market-definition count over the query-sidecar audience spine.
 *
 * Same seam as routes/market.ts (requireUser in, service token out, bodies and
 * statuses verbatim). Distinct route + upstream from the archived audience
 * builder — market-spec defines a market on a call; it never touches
 * contactability (operator ruling 2026-07-16).
 *
 *   POST /count → edge POST /api/v1/market-spec/count
 */

import { Hono } from "hono";

import { type AuthVariables, requireUser } from "../auth.ts";

// Same env seam as lib/edge.ts — EDGE_API_URL + EDGE_API_SERVICE_TOKEN from
// Doppler `hq-rare-structure-hq` (not in env.ts's zod schema by convention).
const EDGE_API_URL = (process.env.EDGE_API_URL ?? "").replace(/\/$/, "");
const EDGE_API_SERVICE_TOKEN = process.env.EDGE_API_SERVICE_TOKEN ?? "";

const MARKET_SPEC = "/api/v1/market-spec";

export const marketSpecRoutes = new Hono<{ Variables: AuthVariables }>();

marketSpecRoutes.use("*", requireUser);

marketSpecRoutes.post("/count", async (c) => {
  const body = await c.req.text();
  const res = await fetch(`${EDGE_API_URL}${MARKET_SPEC}/count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EDGE_API_SERVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(text, { status: res.status, headers: { "content-type": contentType } });
});
