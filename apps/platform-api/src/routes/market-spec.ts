/**
 * market-spec broker — proxies the Market tab's market-spec instrument to
 * core-x catalyst_api's spec engine (relocated from edge_api, core-x #1181) (`/api/v1/market-spec/*`): the live
 * market-definition count over the query-sidecar audience spine.
 *
 * Same seam as routes/market.ts (requireUser in, service token out, bodies and
 * statuses verbatim). Distinct route + upstream from the archived audience
 * builder — market-spec defines a market on a call; it never touches
 * contactability (operator ruling 2026-07-16).
 *
 *   POST /count → catalyst POST /api/v1/market-spec/count
 */

import { Hono } from "hono";

import { type AuthVariables, requireUser } from "../auth.ts";
import { env } from "../env.ts";

// Catalyst seam — CATALYST_API_URL + CATALYST_API_TOKEN from Doppler
// `hq-rare-structure-hq`, zod-validated fail-fast at boot in env.ts.
const CATALYST_API_URL = env.CATALYST_API_URL;
const CATALYST_API_TOKEN = env.CATALYST_API_TOKEN;

const MARKET_SPEC = "/api/v1/market-spec";

export const marketSpecRoutes = new Hono<{ Variables: AuthVariables }>();

marketSpecRoutes.use("*", requireUser);

marketSpecRoutes.post("/count", async (c) => {
  const body = await c.req.text();
  const res = await fetch(`${CATALYST_API_URL}${MARKET_SPEC}/count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CATALYST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(text, { status: res.status, headers: { "content-type": contentType } });
});
