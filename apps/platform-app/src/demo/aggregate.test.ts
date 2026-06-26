/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { resolveAggregate } from "./data";
import type { MarketAggregate } from "./federalApi";

/**
 * resolveAggregate maps the `/ask` aggregate envelope → render-ready bars. The load-bearing
 * logic is: bar value = summed measure when present (the $ vantage) else the group count;
 * labels are dimension-aware (size_band → a $ range, psc_category → a named category, winner
 * → the entity name); and the unit/title derive from whether a measure was summed.
 */

function agg(partial: Partial<MarketAggregate>): MarketAggregate {
  return {
    groupBy: "awarding_agency",
    measure: "action_obligated_usd",
    metrics: ["count", "sum"],
    matchedRows: 0,
    totalGroups: 0,
    groups: [],
    ...partial,
  };
}

describe("resolveAggregate", () => {
  it("maps a $-measured dimension grouping to USD bars", () => {
    const r = resolveAggregate(
      agg({
        groupBy: "awarding_agency",
        matchedRows: 3604,
        totalGroups: 39,
        groups: [
          { key: "National Aeronautics and Space Administration", count: 60, sum: 928_754_597 },
          { key: "Department of Homeland Security", count: 341, sum: 900_019_429 },
        ],
      }),
      undefined,
      [],
    );
    expect(r.unitLabel).toBe("USD obligated");
    expect(r.title).toBe("Obligated $ by agency");
    expect(r.matchedRows).toBe(3604);
    expect(r.totalGroups).toBe(39);
    expect(r.bars[0]).toEqual({
      key: "National Aeronautics and Space Administration",
      label: "National Aeronautics and Space Administration",
      total: 928_754_597,
      count: 60,
      median: null,
      p90: null,
    });
  });

  it("labels size_band groups as $ ranges (open-ended at both tails)", () => {
    const r = resolveAggregate(
      agg({
        groupBy: "size_band",
        groups: [
          { key: 0, count: 2010, sum: 18_145_731, lo: null, hi: 25_000 },
          { key: 1, count: 1502, sum: 114_613_056, lo: 25_000, hi: 250_000 },
          { key: 5, count: 9, sum: 1_711_948_352, lo: 100_000_000, hi: null },
        ],
      }),
      undefined,
      [],
    );
    expect(r.bars.map((b) => b.label)).toEqual(["< $25K", "$25K – $250K", "> $100.0M"]);
    expect(r.title).toBe("Obligated $ by award size");
  });

  it("names a psc_category and uses the entity name for a winner grouping", () => {
    expect(
      resolveAggregate(
        agg({ groupBy: "psc_category", groups: [{ key: "V", count: 10, sum: 1 }] }),
        undefined,
        [],
      ).bars[0].label,
    ).toBe("V · Transportation/Travel/Relocation");
    expect(
      resolveAggregate(
        agg({
          groupBy: "winner",
          groups: [{ key: "ACME LOGISTICS LLC", count: 4, sum: 9, uei: "X" }],
        }),
        undefined,
        [],
      ).bars[0].label,
    ).toBe("ACME LOGISTICS LLC");
  });

  it("falls back to counts (not $) when no group carries a sum", () => {
    const r = resolveAggregate(
      agg({
        groupBy: "set_aside",
        metrics: ["count"],
        groups: [
          { key: "8A", count: 120 },
          { key: "NONE", count: 80 },
        ],
      }),
      undefined,
      [],
    );
    expect(r.unitLabel).toBe("award actions");
    expect(r.title).toBe("Award actions by set-aside");
    expect(r.bars[0]).toEqual({
      key: "8A",
      label: "8A",
      total: 120,
      count: 120,
      median: null,
      p90: null,
    });
  });

  it("prefers the compiler's title and carries notApplied through", () => {
    const r = resolveAggregate(
      agg({ groups: [{ key: "DoD", count: 1, sum: 5 }] }),
      "Top agencies, transportation services, last 365d",
      ["over $1M"],
    );
    expect(r.title).toBe("Top agencies, transportation services, last 365d");
    expect(r.notApplied).toEqual(["over $1M"]);
  });

  it("carries median + p90 onto bars when the aggregate computed them", () => {
    const r = resolveAggregate(
      agg({
        groupBy: "awarding_agency",
        groups: [{ key: "DoD", count: 10, sum: 100, median: 25, p90: 80 }],
      }),
      undefined,
      [],
    );
    expect(r.bars[0].median).toBe(25);
    expect(r.bars[0].p90).toBe(80);
  });
});
