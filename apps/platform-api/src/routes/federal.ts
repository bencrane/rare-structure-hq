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

import { env } from "../env.ts";
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

// Entity dossier — the side-panel read. UNLIKE the warm endpoints above, this proxies the
// core-x catalyst_api dossier endpoint at request time (three BTREE point-lookups: gold
// identity/rollups/POCs ⊕ award-summary recency/top-agencies ⊕ rolling-90d award actions).
// The BFF stays Lance-free: it brokers the INTERNAL operator token (COREX_SERVICE_TOKEN);
// status + `{data}` envelope pass through verbatim.
//
// AUTH POSTURE — PUBLIC, deliberately: the cockpit /map is public and the payload is
// exclusively public-record SAM/USAspending data. POCs carry name/title/city/state ONLY —
// the SAM source has no email/phone columns, so no contact channel exists to leak. If a
// richer contact dataset ever lands in gold, this route must move behind requireUser.
federalRoutes.get("/entity/:uei/dossier", async (c) => {
  const uei = c.req.param("uei");
  if (!/^[A-Za-z0-9]{12}$/.test(uei)) {
    throw new HTTPException(400, { message: "invalid uei" });
  }
  const actions = c.req.query("actions");
  const qs = actions ? `?actions=${encodeURIComponent(actions)}` : "";
  const res = await fetch(`${env.COREX_API_URL}/api/v1/entities/${uei}/dossier${qs}`, {
    headers: { Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

// Batch dossier — the cockpit's eager-prefetch read. Verbatim pass-through broker to
// catalyst's POST /api/v1/entities/dossiers (≤100 UEIs, partial success: unknown UEIs
// map to null). Body is validated/bounded HERE so a malformed prefetch burst dies at
// the BFF; same PUBLIC posture + rationale as the single dossier route above it.
federalRoutes.post("/entity/dossiers", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "json body required" });
  }
  const ueis = (body as { ueis?: unknown })?.ueis;
  if (!Array.isArray(ueis) || ueis.length === 0 || ueis.length > 100) {
    throw new HTTPException(400, { message: "ueis must be an array of 1..100 entries" });
  }
  if (!ueis.every((u) => typeof u === "string" && /^[A-Za-z0-9]{12}$/.test(u.trim()))) {
    throw new HTTPException(400, { message: "every uei must be 12 alphanumerics" });
  }
  const res = await fetch(`${env.COREX_API_URL}/api/v1/entities/dossiers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ueis: ueis.map((u) => (u as string).trim()) }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

// Natural-language market query. UNLIKE the warm endpoints above, this one round-trips to
// core-x edge_api (one forced-tool Anthropic call → catalyst_api Lance scan → GeoJSON), so it
// is the only federal route that is not purely in-memory. Public posture (the cockpit is
// public); each call costs one LLM round-trip — add rate-limiting here if abuse shows.
federalRoutes.get("/ask", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) throw new HTTPException(400, { message: "q (natural-language query) is required" });
  // Explicit dataset pins stay supported; the default is "auto" — edge_api's router
  // picks the serving table from the sentence ("won an award…" → awards; lifetime-
  // obligation / firmographic phrasing → company).
  const requested = c.req.query("dataset");
  const dataset: AskMarketDataset =
    requested === "winners" || requested === "company" || requested === "awards"
      ? requested
      : "auto";
  try {
    return c.json({ data: await askMarket(dataset, q) });
  } catch (err) {
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "market ask failed",
    });
  }
});
