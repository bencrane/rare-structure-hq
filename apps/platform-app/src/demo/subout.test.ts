/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { type SuboutOpportunity, isValidUei, plotSubout } from "./subout";

/**
 * Guards the map layer's honesty seam: wire rows → plotted dots. Rows without a
 * plottable point (no centroid, or outside the Albers composite) land in
 * `unplotted` — counted, never dotted at a bogus position. The HQ pin projects
 * from meta.target_hq and is null when the target doesn't geocode.
 */

function opp(over: Partial<SuboutOpportunity>): SuboutOpportunity {
  return {
    generated_unique_award_id: "AWD_1",
    award_id_piid: "PIID_1",
    prime_uei: "UEIPRIME0001",
    prime_name: "PRIME ONE LLC",
    naics_code: "541512",
    product_or_service_code: "D302",
    awarding_agency_code: "097",
    awarding_agency_name: "Department of Defense",
    total_obligation: 1_000_000,
    base_and_all_options_value: 2_000_000,
    subaward_count: 3,
    total_subaward_amount: 500_000,
    subcontracting_plan_code: "F",
    award_or_idv_flag: "AWARD",
    idv_type_code: null,
    type_of_set_aside_code: null,
    period_of_performance_current_end_date: "2026-12-31",
    ordering_period_end_date: null,
    pop_state_code: "VA",
    pop_geo_precision: "zip5",
    latitude: 38.9586,
    longitude: -77.357,
    distance_mi: 15.2,
    nearest_federal_site: null,
    matched_via: [],
    ...over,
  };
}

/** Deterministic fake projector: inside a synthetic canvas unless lat < 0. */
function fakeProject(lon: number, lat: number): { x: number; y: number } | null {
  if (lat < 0) return null; // "outside the composite"
  return { x: lon + 200, y: lat * 2 };
}

describe("isValidUei", () => {
  it("accepts exactly 12 alphanumerics, case-insensitive, trimmed", () => {
    expect(isValidUei("EMERZ1234567")).toBe(true);
    expect(isValidUei("  emerz1234567  ".trim())).toBe(true);
    expect(isValidUei(" EMERZ1234567 ")).toBe(true); // isValidUei trims internally
  });
  it("rejects wrong lengths and non-alphanumerics", () => {
    expect(isValidUei("SHORT")).toBe(false);
    expect(isValidUei("THIRTEENCHAR5X")).toBe(false);
    expect(isValidUei("UEI-WITH-DSH")).toBe(false);
    expect(isValidUei("")).toBe(false);
  });
});

describe("plotSubout", () => {
  it("plots rows with coordinates and drops ungeocoded rows to unplotted", () => {
    const rows = [
      opp({ generated_unique_award_id: "A1", latitude: 38.9586, longitude: -77.357 }),
      opp({ generated_unique_award_id: "A2", latitude: null, longitude: null }),
    ];
    const plot = plotSubout(rows, { latitude: 38.88, longitude: -77.09 }, fakeProject);
    expect(plot.plotted.map((o) => o.generated_unique_award_id)).toEqual(["A1"]);
    expect(plot.plotted[0]?.x).toBeCloseTo(-77.357 + 200);
    expect(plot.plotted[0]?.y).toBeCloseTo(38.9586 * 2);
    expect(plot.unplotted.map((o) => o.generated_unique_award_id)).toEqual(["A2"]);
    expect(plot.hq).toEqual({ x: -77.09 + 200, y: 38.88 * 2 });
  });

  it("drops rows the projector cannot place (outside the composite)", () => {
    const rows = [opp({ generated_unique_award_id: "GUAM", latitude: -13.5, longitude: 144.8 })];
    const plot = plotSubout(rows, null, fakeProject);
    expect(plot.plotted).toEqual([]);
    expect(plot.unplotted.map((o) => o.generated_unique_award_id)).toEqual(["GUAM"]);
    expect(plot.hq).toBeNull();
  });

  it("hq is null when the target has no coordinates", () => {
    const plot = plotSubout([], null, fakeProject);
    expect(plot.hq).toBeNull();
    expect(plot.plotted).toEqual([]);
  });

  it("uses the real Albers projector by default (DC-area point lands on canvas)", () => {
    const plot = plotSubout([opp({})], { latitude: 38.8816, longitude: -77.091 });
    expect(plot.plotted).toHaveLength(1);
    const { x, y } = plot.plotted[0] as { x: number; y: number };
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1000);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(590);
    expect(plot.hq).not.toBeNull();
  });
});
