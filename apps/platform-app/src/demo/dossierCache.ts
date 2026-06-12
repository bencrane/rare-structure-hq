/**
 * dossierCache — the eager dossier prefetcher behind the instant side panel.
 *
 * "2 seconds to load the side panel kills a sales demo": the drawer must render its
 * FULL dossier in the same frame it opens. The moment a query result lands, the cache
 * streams batched prefetches for the ENTIRE result set in result order (result lists
 * are ranked, so visible-first falls out naturally), with bounded concurrency. The
 * drawer then reads SYNCHRONOUSLY via `peekDossier` — a hit renders with zero
 * round-trip; a true miss falls back to the single fetch with the existing loading
 * state.
 *
 * Semantics:
 *  - Map<uei, entry> where an entry is a resolved dossier, a known-absent `null`,
 *    or an in-flight promise (dedupe: nothing is ever fetched twice concurrently).
 *  - LRU-capped (~500): peeks/hits refresh recency; the oldest entries evict first.
 *  - Generation-tokened: a new query supersedes the previous prefetch — later waves
 *    stop issuing (in-flight batches still land and fill the cache; harmless).
 *  - `promoteDossier` (hover) jumps one UEI to the front of the line via the single
 *    endpoint when it is not already cached or in flight.
 *
 * Built as a factory (`createDossierCache`) so tests inject fetchers; the app uses
 * the default singleton wired to `federalApi`.
 */

import { type EntityDossier, fetchEntityDossier, fetchEntityDossiers } from "./federalApi";

const UEI_RE = /^[A-Z0-9]{12}$/i;

/** Batch sizing: 50/batch × 3 in flight ⇒ the first ~50 (the visible table page)
 * warm in ONE round-trip (~0.3–0.6s live), and a 1,000-row set fully warms in
 * ~20 batches / 3 lanes ≈ 7 waves — a few seconds, without hammering the BFF. */
const BATCH_SIZE = 50;
const MAX_IN_FLIGHT = 3;
const CACHE_MAX = 500;

type CacheEntry =
  | { state: "hit"; dossier: EntityDossier | null } // null = known-absent
  | { state: "pending"; promise: Promise<EntityDossier | null> };

export type DossierFetchers = {
  fetchOne: (uei: string) => Promise<EntityDossier>;
  fetchBatch: (ueis: string[]) => Promise<Record<string, EntityDossier | null>>;
};

export function createDossierCache(fetchers: DossierFetchers, cacheMax = CACHE_MAX) {
  const cache = new Map<string, CacheEntry>();
  let generation = 0;

  function lruTouch(uei: string, entry: CacheEntry): void {
    // Map iteration order is insertion order — delete+set moves to the back (newest).
    cache.delete(uei);
    cache.set(uei, entry);
    while (cache.size > cacheMax) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  /** Synchronous read for the drawer: dossier (hit), null (known-absent), or
   * undefined (unknown / still in flight — caller falls back to the async path). */
  function peekDossier(uei: string): EntityDossier | null | undefined {
    const entry = cache.get(uei.toUpperCase());
    if (!entry || entry.state !== "hit") return undefined;
    lruTouch(uei.toUpperCase(), entry);
    return entry.dossier;
  }

  /** Async read with in-flight dedupe: returns the cached/in-flight result or starts
   * a SINGLE fetch (the cache-miss fallback + the hover-promotion path). */
  function getDossier(uei: string): Promise<EntityDossier | null> {
    const key = uei.toUpperCase();
    if (!UEI_RE.test(key)) return Promise.resolve(null);
    const entry = cache.get(key);
    if (entry?.state === "hit") return Promise.resolve(entry.dossier);
    if (entry?.state === "pending") return entry.promise;
    const promise = fetchers
      .fetchOne(key)
      .then((d): EntityDossier | null => d ?? null)
      .catch((): null => null)
      .then((d) => {
        lruTouch(key, { state: "hit", dossier: d });
        return d;
      });
    lruTouch(key, { state: "pending", promise });
    return promise;
  }

  /** Hover promotion: warm one UEI immediately if not already cached/in flight. */
  function promoteDossier(uei: string): void {
    const key = uei.toUpperCase();
    if (!UEI_RE.test(key) || cache.has(key)) return;
    void getDossier(key);
  }

  async function runBatch(ueis: string[]): Promise<void> {
    let resolveAll: (m: Record<string, EntityDossier | null>) => void = () => {};
    const shared = new Promise<Record<string, EntityDossier | null>>((res) => {
      resolveAll = res;
    });
    // Mark every batch member in-flight up front so overlapping prefetches dedupe.
    for (const u of ueis) {
      lruTouch(u, { state: "pending", promise: shared.then((m) => m[u] ?? null) });
    }
    let result: Record<string, EntityDossier | null> = {};
    try {
      result = await fetchers.fetchBatch(ueis);
    } catch {
      // Batch failure → unmark (drop the pending entries) so the drawer's single
      // fetch fallback can retry; never poison the cache with failures.
      for (const u of ueis) cache.delete(u);
      resolveAll({});
      return;
    }
    for (const u of ueis) {
      lruTouch(u, { state: "hit", dossier: result[u] ?? null });
    }
    resolveAll(result);
  }

  /** Stream batched prefetches for a (ranked) result set. Supersedes any previous
   * prefetch run; never blocks the caller — fire and forget. */
  function startPrefetch(ueis: string[]): void {
    generation += 1;
    const mine = generation;
    const queue = ueis
      .map((u) => u.toUpperCase())
      .filter((u, i, all) => UEI_RE.test(u) && all.indexOf(u) === i && !cache.has(u));
    const batches: string[][] = [];
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      batches.push(queue.slice(i, i + BATCH_SIZE));
    }
    let next = 0;
    const lane = async (): Promise<void> => {
      while (next < batches.length && generation === mine) {
        const batch = batches[next];
        next += 1;
        // Re-filter inside the lane: hover promotion may have warmed members already.
        const pending = batch.filter((u) => !cache.has(u));
        if (pending.length > 0) await runBatch(pending);
      }
    };
    for (let i = 0; i < MAX_IN_FLIGHT; i += 1) {
      void lane();
    }
  }

  /** Test/inspection hooks — not for app code. */
  const _internal = {
    size: () => cache.size,
    has: (u: string) => cache.has(u.toUpperCase()),
    generationNow: () => generation,
  };

  return { peekDossier, getDossier, promoteDossier, startPrefetch, _internal };
}

// The app-wide singleton, wired to the live BFF endpoints.
const singleton = createDossierCache({
  fetchOne: fetchEntityDossier,
  fetchBatch: fetchEntityDossiers,
});

export const peekDossier = singleton.peekDossier;
export const getDossier = singleton.getDossier;
export const promoteDossier = singleton.promoteDossier;
export const startDossierPrefetch = singleton.startPrefetch;
