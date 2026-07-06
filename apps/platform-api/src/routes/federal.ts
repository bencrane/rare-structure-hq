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
 *   GET /query-fields                 workbench field catalog (catalyst /map/fields proxy)
 *   POST /query/:dataset              workbench deterministic query (catalyst /map/{ds}/query proxy)
 *   GET /query-codes                  workbench NAICS/PSC typeahead (catalyst /market/codes proxy)
 *   POST /subout-opportunities        per-UEI sub-out opportunities (catalyst /market/subout-opportunities
 *                                     proxy, 15-min in-memory response cache)
 *
 * Each response is the `{ data }` envelope the app's house fetch pattern expects.
 */

import { createHash } from "node:crypto";

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

// Capability profile — the per-firm card read. Same PUBLIC posture + dumb-BFF broker as the
// dossier route above: proxies catalyst GET /api/v1/entities/{uei}/capability-profile with the
// INTERNAL service token; status + {data} envelope pass through verbatim. Payload is public-
// record SAM/USAspending-derived capability (identity, designations, sub/prime activity, lanes).
federalRoutes.get("/entity/:uei/capability-profile", async (c) => {
  const uei = c.req.param("uei");
  if (!/^[A-Za-z0-9]{12}$/.test(uei)) {
    throw new HTTPException(400, { message: "invalid uei" });
  }
  const res = await fetch(`${env.COREX_API_URL}/api/v1/entities/${uei}/capability-profile`, {
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

// ── Query workbench — the deterministic filter surface ──────────────────────
// Dumb-BFF brokers to catalyst's map query engine. The workbench is the operator's
// testing surface for the deterministic path: every filter is composed explicitly in the
// UI (no LLM), so unsupported fields/ops must surface loudly, never silently. All routes
// pass status + body through VERBATIM — in particular catalyst's 422 `"invalid filter: …"`
// detail string, which IS the workbench's "axis not yet configured" signal.
//
// AUTH POSTURE — PUBLIC, same rationale as the dossier/capability routes above: the cockpit
// /map is public and the payload is exclusively public-record SAM/USAspending data. The BFF
// stays Lance-free and brokers the INTERNAL operator token (COREX_SERVICE_TOKEN).

// The concrete serving datasets catalyst's map query engine exposes — the Gen-3 tables
// (`entities`, `prime_awards`, `transactions`) plus the retiring Gen-2 five (flagged
// `legacy` in the fields payload; the UI hides them). No "auto" here — the workbench is
// deterministic-only; sentence routing belongs to /ask.
const WORKBENCH_DATASETS = new Set([
  "entities",
  "prime_awards",
  "transactions",
  "company",
  "winners",
  "awards",
  "active",
  "contracts",
]);

// Field catalog — which fields/ops/enums each dataset supports (+ decoderVersion). The UI
// populates its dropdowns ONLY from this, never from hardcoded lists.
federalRoutes.get("/query-fields", async (c) => {
  const res = await fetch(`${env.COREX_API_URL}/api/v1/map/fields`, {
    headers: { Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

// Deterministic query — the composed `{filters, limit}` body is forwarded verbatim (no
// reshaping: what the operator composed is exactly what catalyst validates), and the
// response (200 GeoJSON + meta, or the 422 invalid-filter detail) passes back verbatim.
// Dataset is validated HERE so a bogus path dies at the BFF as a 400, distinct from
// catalyst's 422 (unsupported filter) and 404 (unknown dataset upstream).
federalRoutes.post("/query/:dataset", async (c) => {
  const dataset = c.req.param("dataset");
  if (!WORKBENCH_DATASETS.has(dataset)) {
    throw new HTTPException(400, {
      message: `unknown dataset "${dataset}" — expected one of entities, prime_awards, transactions, company, winners, awards, active, contracts`,
    });
  }
  const body = await c.req.text();
  const res = await fetch(`${env.COREX_API_URL}/api/v1/map/${dataset}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}`,
      "content-type": "application/json",
    },
    body,
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

// Code registry search — the workbench's NAICS/PSC typeahead. Proxies catalyst
// GET /api/v1/market/codes with the service token; `q`/`type`/`limit` pass through
// untouched, status + body verbatim (including catalyst's 422 on an empty `q`).
// Same PUBLIC posture as the workbench brokers above: the registries are public
// federal code dimensions, nothing operator-scoped.
federalRoutes.get("/query-codes", async (c) => {
  const qs = new URLSearchParams();
  for (const key of ["q", "type", "limit"] as const) {
    const v = c.req.query(key);
    if (v != null) qs.set(key, v);
  }
  const suffix = qs.toString();
  const res = await fetch(`${env.COREX_API_URL}/api/v1/market/codes${suffix ? `?${suffix}` : ""}`, {
    headers: { Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

// ── Sub-out opportunities — the per-UEI demo path ───────────────────────────
// Dumb-BFF broker to catalyst's POST /api/v1/market/subout-opportunities (the
// subout_opportunities.v1 recipe): body forwarded VERBATIM, status + body passed back
// verbatim — including catalyst's 422 "invalid filter: …" detail, same honesty posture
// as the workbench brokers above. Same PUBLIC posture too: the payload is exclusively
// public-record USAspending prime-award data.
//
// RESPONSE CACHE — the millisecond path. Catalyst's first hit for a UEI can run slow
// inferred probes (hence the 120s upstream timeout); every identical request within the
// TTL is answered from an in-memory LRU keyed by the canonicalized request body. Only
// 200s are cached. The body is NEVER mutated — cache state is signaled exclusively via
// the `x-cache: hit|miss` response header. `?fresh=1` bypasses the lookup and
// repopulates the entry.

/** How long a cached 200 stays servable. */
const SUBOUT_CACHE_TTL_MS = 15 * 60 * 1000;
/** Hard cap on cached responses; least-recently-used entry is evicted at the cap. */
export const SUBOUT_CACHE_MAX_ENTRIES = 500;
/** Upstream budget — first-hit inferred probes on catalyst can be slow; the cache is the fix. */
const SUBOUT_UPSTREAM_TIMEOUT_MS = 120_000;

type SuboutCacheEntry = { body: string; contentType: string; expiresAt: number };

// Map iterates in insertion order, so delete+re-set on read makes it an LRU: the first
// key is always the least recently used.
const suboutCache = new Map<string, SuboutCacheEntry>();

/** Test-only: reset the module-level cache between cases. */
export function clearSuboutCache(): void {
  suboutCache.clear();
}

/** Recursively sort object keys so semantically identical bodies canonicalize identically. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, canonicalize(obj[k])]),
    );
  }
  return value;
}

/** Stable cache key: sha256 of the key-sorted JSON body (raw text if the body isn't JSON). */
function suboutCacheKey(rawBody: string): string {
  let canonical = rawBody;
  try {
    canonical = JSON.stringify(canonicalize(JSON.parse(rawBody)));
  } catch {
    // Not JSON — catalyst will reject it; key on the raw text so the (uncached) 4xx
    // still round-trips deterministically.
  }
  return createHash("sha256").update(canonical).digest("hex");
}

function suboutCacheGet(key: string): SuboutCacheEntry | undefined {
  const entry = suboutCache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    suboutCache.delete(key);
    return undefined;
  }
  suboutCache.delete(key);
  suboutCache.set(key, entry); // refresh recency
  return entry;
}

function suboutCacheSet(key: string, entry: SuboutCacheEntry): void {
  suboutCache.delete(key);
  if (suboutCache.size >= SUBOUT_CACHE_MAX_ENTRIES) {
    const oldest = suboutCache.keys().next();
    if (!oldest.done) suboutCache.delete(oldest.value);
  }
  suboutCache.set(key, entry);
}

federalRoutes.post("/subout-opportunities", async (c) => {
  const rawBody = await c.req.text();
  const key = suboutCacheKey(rawBody);

  if (c.req.query("fresh") !== "1") {
    const cached = suboutCacheGet(key);
    if (cached) {
      return new Response(cached.body, {
        status: 200,
        headers: { "content-type": cached.contentType, "x-cache": "hit" },
      });
    }
  }

  const res = await fetch(`${env.COREX_API_URL}/api/v1/market/subout-opportunities`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}`,
      "content-type": "application/json",
    },
    body: rawBody,
    signal: AbortSignal.timeout(SUBOUT_UPSTREAM_TIMEOUT_MS),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  if (res.status === 200) {
    suboutCacheSet(key, { body: text, contentType, expiresAt: Date.now() + SUBOUT_CACHE_TTL_MS });
  }
  return new Response(text, {
    status: res.status,
    headers: { "content-type": contentType, "x-cache": "miss" },
  });
});

// ── Deterministic phrase compiler — verbatim broker ─────────────────────────
// catalyst POST /api/v1/market/phrase (phrase.v1): closed grammar, zero LLM.
// Body + status + response pass through VERBATIM — in particular the 422 whose
// detail names the refusing token (the vocabulary teaching surface). No response
// cache: phrases vary and the compiled pipeline is already bounded upstream.
federalRoutes.post("/phrase", async (c) => {
  const rawBody = await c.req.text();
  const res = await fetch(`${env.COREX_API_URL}/api/v1/market/phrase`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}`,
      "content-type": "application/json",
    },
    body: rawBody,
    signal: AbortSignal.timeout(120_000),
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
    requested === "winners" ||
    requested === "company" ||
    requested === "awards" ||
    requested === "active" ||
    requested === "contracts"
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
