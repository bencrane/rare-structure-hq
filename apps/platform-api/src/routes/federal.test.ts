/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";

/**
 * Guards the query-workbench broker contract on the federal routes:
 *
 *  - GET  /query-fields      proxies catalyst GET /api/v1/map/fields with the service
 *                            token; status + body pass through verbatim.
 *  - POST /query/:dataset    validates the dataset (400 at the BFF for anything outside
 *                            the six serving tables — catalyst is never called), then
 *                            forwards the body verbatim and passes the response through
 *                            verbatim — INCLUDING the 422 "invalid filter: …" detail,
 *                            which is the workbench's "axis not configured" signal.
 *  - GET  /query-codes       proxies catalyst GET /api/v1/market/codes (the NAICS/PSC
 *                            typeahead); q/type/limit pass through untouched.
 *  - POST /subout-opportunities
 *                            proxies catalyst POST /api/v1/market/subout-opportunities,
 *                            body + status verbatim, with a 15-min in-memory LRU response
 *                            cache (200s only, `x-cache: hit|miss` header, `?fresh=1`
 *                            bypass) — the millisecond demo path.
 *
 * Catalyst is stubbed at the global-fetch seam; no network leaves the test.
 */

// env.ts validates the full schema at import time (process.exit on failure) — provide
// every key BEFORE the route module loads. COREX_* values are asserted against below.
process.env.HQX_SUPABASE_URL ??= "https://hqx.test.supabase.co";
process.env.HQX_SUPABASE_JWKS_URL ??= "https://hqx.test.supabase.co/auth/v1/.well-known/jwks.json";
process.env.HQX_SUPABASE_ISSUER ??= "https://hqx.test.supabase.co/auth/v1";
process.env.HQX_SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.COREX_API_URL = "https://catalyst.test";
process.env.COREX_SERVICE_TOKEN = "test-corex-token";
process.env.CATALYST_API_URL = "https://catalyst.test";
process.env.CATALYST_API_TOKEN = "test-catalyst-token";
process.env.APP_ENV ??= "dev";

const { federalRoutes, clearSuboutCache, SUBOUT_CACHE_MAX_ENTRIES } = await import("./federal.ts");

type RecordedCall = { url: string; init?: RequestInit };

const realFetch = globalThis.fetch;
let calls: RecordedCall[] = [];

/** Replace global fetch with a recorder that answers every call with `response`. */
function stubCatalyst(response: () => Response): void {
  calls = [];
  globalThis.fetch = ((url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(response());
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("GET /query-fields", () => {
  it("proxies catalyst /api/v1/map/fields with the service token, verbatim body + status", async () => {
    const catalog =
      '{"data":{"datasets":{"company":{"decoderVersion":"v3","fields":[{"name":"state_code","type":"string","ops":["=","in"],"enum":["VA","MD"],"index":"BTREE","gated":false}],"aggregate":null}}}}';
    stubCatalyst(
      () => new Response(catalog, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const res = await federalRoutes.request("/query-fields");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(catalog);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://catalyst.test/api/v1/map/fields");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-corex-token",
    );
  });

  it("passes a catalyst failure status through untouched", async () => {
    stubCatalyst(() => new Response('{"detail":"catalog unavailable"}', { status: 503 }));

    const res = await federalRoutes.request("/query-fields");

    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"detail":"catalog unavailable"}');
  });
});

describe("POST /query/:dataset", () => {
  const filtersBody = JSON.stringify({
    filters: [{ field: "state_code", op: "in", value: ["VA", "MD"] }],
    limit: 200,
  });

  it("forwards the body verbatim to catalyst and passes the 200 through", async () => {
    const geo =
      '{"data":{"type":"FeatureCollection","features":[]},"meta":{"dataset":"company","decoderVersion":"v3","returned":0,"plottable":0,"total":0,"capped":false}}';
    stubCatalyst(
      () => new Response(geo, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const res = await federalRoutes.request("/query/company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: filtersBody,
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(geo);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://catalyst.test/api/v1/map/company/query");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.body).toBe(filtersBody);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-corex-token",
    );
  });

  it("passes a catalyst 422 invalid-filter detail through verbatim — the honesty signal", async () => {
    const detail = '{"detail":"invalid filter: field \'employees\' not queryable on company"}';
    stubCatalyst(
      () => new Response(detail, { status: 422, headers: { "content-type": "application/json" } }),
    );

    const res = await federalRoutes.request("/query/company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: filtersBody,
    });

    expect(res.status).toBe(422);
    expect(await res.text()).toBe(detail);
  });

  it("400s an unknown dataset at the BFF without calling catalyst", async () => {
    stubCatalyst(() => new Response("must not be reached", { status: 200 }));

    const res = await federalRoutes.request("/query/bogus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: filtersBody,
    });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('unknown dataset "bogus"');
    expect(calls).toHaveLength(0);
  });

  it("accepts each of the eight serving datasets (Gen-3 entities/prime_awards/transactions included)", async () => {
    for (const dataset of [
      "entities",
      "prime_awards",
      "transactions",
      "company",
      "winners",
      "awards",
      "active",
      "contracts",
    ]) {
      stubCatalyst(() => new Response('{"data":{}}', { status: 200 }));
      const res = await federalRoutes.request(`/query/${dataset}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: filtersBody,
      });
      expect(res.status).toBe(200);
      expect(calls[0].url).toBe(`https://catalyst.test/api/v1/map/${dataset}/query`);
    }
  });
});

describe("GET /query-codes", () => {
  it("proxies catalyst /api/v1/market/codes with the service token, q/type/limit untouched", async () => {
    const codes =
      '{"data":[{"code":"541511","description":"Custom Computer Programming Services"}]}';
    stubCatalyst(
      () => new Response(codes, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const res = await federalRoutes.request("/query-codes?type=naics&q=custom%20comp&limit=20");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(codes);
    expect(calls).toHaveLength(1);
    const upstream = new URL(calls[0].url);
    expect(`${upstream.origin}${upstream.pathname}`).toBe(
      "https://catalyst.test/api/v1/market/codes",
    );
    expect(upstream.searchParams.get("type")).toBe("naics");
    expect(upstream.searchParams.get("q")).toBe("custom comp");
    expect(upstream.searchParams.get("limit")).toBe("20");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-corex-token",
    );
  });

  it("passes catalyst's 422 (empty q) through verbatim", async () => {
    const detail = '{"detail":"q is required"}';
    stubCatalyst(
      () => new Response(detail, { status: 422, headers: { "content-type": "application/json" } }),
    );

    const res = await federalRoutes.request("/query-codes?type=psc&q=");

    expect(res.status).toBe(422);
    expect(await res.text()).toBe(detail);
  });
});

describe("POST /subout-opportunities", () => {
  const requestBody = JSON.stringify({ uei: "ABC123DEF456", lenses: ["geo"] });
  const payload = '{"data":{"uei":"ABC123DEF456","opportunities":[{"award_id":"W91"}]}}';

  /** POST the route with an optional body/path override. */
  function post(body: string = requestBody, path = "/subout-opportunities") {
    return federalRoutes.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  }

  // The cache is module-level state; every case starts empty. System time is restored
  // in case a TTL test faked it.
  beforeEach(() => {
    clearSuboutCache();
    setSystemTime();
  });
  afterEach(() => {
    setSystemTime();
  });

  it("proxies catalyst verbatim with the service token and marks the first hit x-cache: miss", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(payload);
    expect(res.headers.get("x-cache")).toBe("miss");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://catalyst.test/api/v1/market/subout-opportunities");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.body).toBe(requestBody);
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-corex-token",
    );
  });

  it("passes a catalyst 422 invalid-filter detail through verbatim and never caches it", async () => {
    const detail = '{"detail":"invalid filter: lens \'psc\' not supported"}';
    stubCatalyst(
      () => new Response(detail, { status: 422, headers: { "content-type": "application/json" } }),
    );

    const first = await post();
    expect(first.status).toBe(422);
    expect(await first.text()).toBe(detail);
    expect(first.headers.get("x-cache")).toBe("miss");

    // Identical body again — the 422 was not cached, so catalyst is called again.
    const second = await post();
    expect(second.status).toBe(422);
    expect(second.headers.get("x-cache")).toBe("miss");
    expect(calls).toHaveLength(2);
  });

  it("serves an identical body from cache — one fetch, x-cache: hit, body untouched", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const first = await post();
    expect(first.headers.get("x-cache")).toBe("miss");

    const second = await post();
    expect(second.status).toBe(200);
    expect(second.headers.get("x-cache")).toBe("hit");
    expect(await second.text()).toBe(payload);
    expect(calls).toHaveLength(1);
  });

  it("canonicalizes the body — key order does not fork the cache entry", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    await post(JSON.stringify({ uei: "ABC123DEF456", lenses: ["geo"] }));
    const reordered = await post(JSON.stringify({ lenses: ["geo"], uei: "ABC123DEF456" }));

    expect(reordered.headers.get("x-cache")).toBe("hit");
    expect(calls).toHaveLength(1);
  });

  it("keys different bodies to different cache entries", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    await post(JSON.stringify({ uei: "ABC123DEF456" }));
    const other = await post(JSON.stringify({ uei: "XYZ789QRS012" }));

    expect(other.headers.get("x-cache")).toBe("miss");
    expect(calls).toHaveLength(2);
  });

  it("expires an entry after the 15-minute TTL", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    const start = Date.now();
    setSystemTime(new Date(start));
    await post();

    // One millisecond before expiry: still a hit.
    setSystemTime(new Date(start + 15 * 60 * 1000 - 1));
    expect((await post()).headers.get("x-cache")).toBe("hit");
    expect(calls).toHaveLength(1);

    // At expiry: the entry is dead; catalyst is called again and the cache repopulates.
    setSystemTime(new Date(start + 15 * 60 * 1000));
    expect((await post()).headers.get("x-cache")).toBe("miss");
    expect(calls).toHaveLength(2);
  });

  it("fresh=1 bypasses the cache and repopulates the entry", async () => {
    let hits = 0;
    stubCatalyst(() => {
      hits += 1;
      return new Response(`{"data":{"revision":${hits}}}`, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await post(); // populate: revision 1
    const bypass = await post(requestBody, "/subout-opportunities?fresh=1");
    expect(bypass.headers.get("x-cache")).toBe("miss");
    expect(await bypass.text()).toBe('{"data":{"revision":2}}');
    expect(calls).toHaveLength(2);

    // The bypass repopulated the entry — the next plain read serves revision 2 from cache.
    const after = await post();
    expect(after.headers.get("x-cache")).toBe("hit");
    expect(await after.text()).toBe('{"data":{"revision":2}}');
    expect(calls).toHaveLength(2);
  });

  it("evicts the least-recently-used entry at the cap", async () => {
    stubCatalyst(
      () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } }),
    );

    // Fill the cache to the cap: uei-0 … uei-(MAX-1), inserted in order.
    for (let i = 0; i < SUBOUT_CACHE_MAX_ENTRIES; i++) {
      await post(JSON.stringify({ uei: `uei-${i}` }));
    }
    expect(calls).toHaveLength(SUBOUT_CACHE_MAX_ENTRIES);

    // Touch uei-0 so uei-1 becomes the least recently used.
    expect((await post(JSON.stringify({ uei: "uei-0" }))).headers.get("x-cache")).toBe("hit");
    expect(calls).toHaveLength(SUBOUT_CACHE_MAX_ENTRIES);

    // One past the cap evicts exactly the LRU entry (uei-1)…
    await post(JSON.stringify({ uei: "uei-overflow" }));
    expect(calls).toHaveLength(SUBOUT_CACHE_MAX_ENTRIES + 1);

    // …so uei-0 survives (hit) while uei-1 refetches (miss).
    expect((await post(JSON.stringify({ uei: "uei-0" }))).headers.get("x-cache")).toBe("hit");
    expect(calls).toHaveLength(SUBOUT_CACHE_MAX_ENTRIES + 1);
    expect((await post(JSON.stringify({ uei: "uei-1" }))).headers.get("x-cache")).toBe("miss");
    expect(calls).toHaveLength(SUBOUT_CACHE_MAX_ENTRIES + 2);
  });
});

describe("POST /phrase (deterministic phrase compiler broker)", () => {
  it("proxies catalyst /api/v1/market/phrase verbatim — body, token, status", async () => {
    const payload = '{"meta":{"compilerVersion":"phrase.v1"},"data":{"rows":[]}}';
    stubCatalyst(() => new Response(payload, { status: 200 }));
    const res = await federalRoutes.request("/phrase", {
      method: "POST",
      body: '{"phrase":"vehicles carrying naics 541512"}',
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(payload);
    expect(calls[0].url).toBe("https://catalyst.test/api/v1/market/phrase");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-corex-token");
    expect(calls[0].init?.body).toBe('{"phrase":"vehicles carrying naics 541512"}');
  });

  it("passes the 422 refusal detail through verbatim — the teaching surface", async () => {
    const refusal =
      '{"detail":"phrase refused: token \'profitable\' — not in the phrase vocabulary"}';
    stubCatalyst(() => new Response(refusal, { status: 422 }));
    const res = await federalRoutes.request("/phrase", {
      method: "POST",
      body: '{"phrase":"profitable construction companies"}',
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(422);
    expect(await res.text()).toBe(refusal);
  });
});
