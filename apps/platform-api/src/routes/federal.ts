/**
 * Federal serving routes — the live data behind the public map/chart cockpit.
 *
 * WARM, NO COLD START. Every handler reads the in-memory `federal-store` snapshot
 * (loaded once at boot from bundled static artifacts that core-x precomputed). NO
 * handler opens Lance, runs DuckDB, or round-trips to core-x at request time. This is
 * the hard invariant for the public surface.
 *
 * AUTH POSTURE — PUBLIC. The cockpit `/map` route is public (per the platform audit), so
 * these read endpoints are mounted WITHOUT `requireUser`: the federal universe is public
 * federal-spend data, a different (public) audience from the operator's authenticated CRM.
 * They are read-only projections of a precomputed public snapshot — nothing operator- or
 * tenant-scoped is exposed. (CORS still gates browser origins via the app-wide policy.)
 *
 * Routes:
 *   GET /spend-by-industry            top-N NAICS spend bars
 *   GET /spend-by-state               US-jurisdiction spend bars
 *   GET /spend-by-agency              awarding-agency spend bars
 *   GET /entities?naics=&minObligation=&state=&activeOnly=&limit=&offset=
 *                                     the map/list slice, filtered in-memory (paged)
 *   GET /entity/:uei                  one entity for the profile drawer
 *
 * Each response is the `{ data }` envelope the app's house fetch pattern expects.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { federalEntityQuerySchema } from "@rare-structure-hq/shared";

import { type AskMarketDataset, askMarket } from "../lib/edge.ts";
import {
  agencyChart,
  entityByUei,
  entityList,
  industryChart,
  stateChart,
} from "../lib/federal-store.ts";

export const federalRoutes = new Hono();

federalRoutes.get("/spend-by-industry", (c) => c.json({ data: industryChart() }));
federalRoutes.get("/spend-by-state", (c) => c.json({ data: stateChart() }));
federalRoutes.get("/spend-by-agency", (c) => c.json({ data: agencyChart() }));

federalRoutes.get("/entities", (c) => {
  const parsed = federalEntityQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  return c.json({ data: entityList(parsed.data) });
});

federalRoutes.get("/entity/:uei", (c) => {
  const uei = c.req.param("uei");
  const entity = entityByUei(uei);
  if (!entity) throw new HTTPException(404, { message: "entity not found" });
  return c.json({ data: entity });
});

// Natural-language market query. UNLIKE the warm endpoints above, this one round-trips to
// core-x edge_api (one forced-tool Anthropic call → catalyst_api Lance scan → GeoJSON), so it
// is the only federal route that is not purely in-memory. Public posture (the cockpit is
// public); each call costs one LLM round-trip — add rate-limiting here if abuse shows.
federalRoutes.get("/ask", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) throw new HTTPException(400, { message: "q (natural-language query) is required" });
  const dataset: AskMarketDataset = c.req.query("dataset") === "winners" ? "winners" : "company";
  try {
    return c.json({ data: await askMarket(dataset, q) });
  } catch (err) {
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "market ask failed",
    });
  }
});
