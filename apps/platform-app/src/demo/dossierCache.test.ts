/**
 * dossierCache tests — the instant-drawer contract: synchronous peek on a hit,
 * in-flight dedupe, LRU cap, supersede-on-new-query, batch-failure fallback, and
 * hover promotion. Fetchers are injected (createDossierCache); no network.
 */

import { describe, expect, test } from "bun:test";
import { type DossierFetchers, createDossierCache } from "./dossierCache";
import type { EntityDossier } from "./federalApi";

function fakeDossier(uei: string): EntityDossier {
  return {
    identity: {
      uei,
      cageCode: null,
      legalBusinessName: `CO ${uei}`,
      dbaName: null,
      isActive: true,
      primaryNaics: null,
      address: null,
    },
    posture: {
      totalLifetimeObligations: 1,
      totalActiveObligations: 1,
      awardCount: 1,
      activeAwardCount: 1,
      hasFederalAwards: true,
      latestActionDate: null,
      daysSinceLastAction: null,
      topAgencies: [],
      profileAsOfDate: null,
    },
    recentActivity: { windowDays: 90, actions: [] },
    pocs: [],
  };
}

function uei(n: number): string {
  return `U${String(n).padStart(11, "0")}`;
}

type Harness = {
  cache: ReturnType<typeof createDossierCache>;
  batchCalls: string[][];
  singleCalls: string[];
  /** resolve queued batches manually when manual=true */
  flushBatches: () => void;
};

function harness(opts: { manual?: boolean; cacheMax?: number } = {}): Harness {
  const batchCalls: string[][] = [];
  const singleCalls: string[] = [];
  const pendingResolvers: (() => void)[] = [];
  const fetchers: DossierFetchers = {
    fetchOne: (u) => {
      singleCalls.push(u);
      return Promise.resolve(fakeDossier(u));
    },
    fetchBatch: (us) => {
      batchCalls.push(us);
      const result = Object.fromEntries(
        us.map((u) => [u, u.startsWith("ZZZ") ? null : fakeDossier(u)]),
      );
      if (!opts.manual) return Promise.resolve(result);
      return new Promise((res) => {
        pendingResolvers.push(() => res(result));
      });
    },
  };
  return {
    cache: createDossierCache(fetchers, opts.cacheMax ?? 500),
    batchCalls,
    singleCalls,
    flushBatches: () => {
      for (const r of pendingResolvers.splice(0)) r();
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("dossierCache", () => {
  test("peek is synchronous after prefetch lands (the instant-drawer hit)", async () => {
    const h = harness();
    h.cache.startPrefetch([uei(1), uei(2)]);
    await tick();
    await tick();
    const hit = h.cache.peekDossier(uei(1));
    expect(hit?.identity.uei).toBe(uei(1)); // no await between peek and render
    expect(h.batchCalls.length).toBe(1);
  });

  test("known-absent UEIs peek as null (not undefined → no refetch loop)", async () => {
    const h = harness();
    h.cache.startPrefetch([`ZZZ${"0".repeat(9)}`]);
    await tick();
    await tick();
    expect(h.cache.peekDossier(`ZZZ${"0".repeat(9)}`)).toBeNull();
  });

  test("in-flight dedupe: getDossier during a pending batch issues no single fetch", async () => {
    const h = harness({ manual: true });
    h.cache.startPrefetch([uei(1)]);
    await tick();
    const p = h.cache.getDossier(uei(1)); // joins the in-flight batch promise
    h.flushBatches();
    const d = await p;
    expect(d?.identity.uei).toBe(uei(1));
    expect(h.singleCalls.length).toBe(0);
    expect(h.batchCalls.length).toBe(1);
  });

  test("cache miss falls back to ONE single fetch (dedupe across callers)", async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.cache.getDossier(uei(9)), h.cache.getDossier(uei(9))]);
    expect(a?.identity.uei).toBe(uei(9));
    expect(b).toBe(a);
    expect(h.singleCalls).toEqual([uei(9)]);
  });

  test("LRU cap evicts the oldest beyond the bound", async () => {
    const h = harness({ cacheMax: 3 });
    h.cache.startPrefetch([uei(1), uei(2), uei(3), uei(4)]);
    await tick();
    await tick();
    expect(h.cache._internal.size()).toBe(3);
    expect(h.cache._internal.has(uei(1))).toBe(false); // oldest evicted
    expect(h.cache._internal.has(uei(4))).toBe(true);
  });

  test("a new query supersedes the previous prefetch (later waves stop)", async () => {
    const h = harness({ manual: true });
    // 3 lanes × 50/batch: 200 UEIs = 4 batches → 3 issue immediately, 1 queued.
    h.cache.startPrefetch(Array.from({ length: 200 }, (_, i) => uei(i + 100)));
    await tick();
    expect(h.batchCalls.length).toBe(3);
    h.cache.startPrefetch([uei(999)]); // SUPERSEDE before wave 2
    h.flushBatches(); // old in-flight batches resolve…
    await tick();
    await tick();
    // …but the old generation's 4th batch never issues; only the new query's batch does.
    expect(h.batchCalls.length).toBe(4);
    expect(h.batchCalls[3]).toEqual([uei(999)]);
  });

  test("batch failure unmarks members so the single-fetch fallback can retry", async () => {
    const batchCalls: string[][] = [];
    const singleCalls: string[] = [];
    const cache = createDossierCache({
      fetchOne: (u) => {
        singleCalls.push(u);
        return Promise.resolve(fakeDossier(u));
      },
      fetchBatch: (us) => {
        batchCalls.push(us);
        return Promise.reject(new Error("bff down"));
      },
    });
    cache.startPrefetch([uei(1)]);
    await tick();
    await tick();
    expect(cache.peekDossier(uei(1))).toBeUndefined(); // failure never poisons the cache
    const d = await cache.getDossier(uei(1)); // drawer fallback path still works
    expect(d?.identity.uei).toBe(uei(1));
    expect(singleCalls).toEqual([uei(1)]);
  });

  test("hover promotion warms exactly once and respects existing entries", async () => {
    const h = harness();
    h.cache.promoteDossier(uei(5));
    h.cache.promoteDossier(uei(5)); // in-flight → no second fetch
    await tick();
    h.cache.promoteDossier(uei(5)); // cached → no fetch
    expect(h.singleCalls).toEqual([uei(5)]);
    expect(h.cache.peekDossier(uei(5))?.identity.uei).toBe(uei(5));
  });

  test("non-UEI ids never fetch", async () => {
    const h = harness();
    h.cache.startPrefetch(["Acme Construction", "short"]);
    expect(await h.cache.getDossier("not-a-uei")).toBeNull();
    await tick();
    expect(h.batchCalls.length).toBe(0);
    expect(h.singleCalls.length).toBe(0);
  });
});
