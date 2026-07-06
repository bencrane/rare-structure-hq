/// <reference types="bun-types" />
import { afterEach, describe, expect, it } from "bun:test";

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
process.env.APP_ENV ??= "dev";

const { federalRoutes } = await import("./federal.ts");

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

  it("accepts each of the six serving datasets (Gen-3 entities included)", async () => {
    for (const dataset of ["entities", "company", "winners", "awards", "active", "contracts"]) {
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
