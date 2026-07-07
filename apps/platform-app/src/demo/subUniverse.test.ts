/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import {
  type SubUniverseGateParams,
  type SubUniverseMatchedVia,
  type SubUniverseNode,
  type SubUniverseTarget,
  buildSubUniverseLayer,
  comboOptions,
  defaultGateParams,
  evaluateNode,
  plotSubUniverse,
  vehicleOptions,
} from "./subUniverse";

/**
 * Guards the facts-only doctrine: gates DIM with disclosed reasons, never
 * delete; a node failing multiple gates accumulates ALL reasons; and the
 * plot seam mirrors subout (unplottable nodes counted, never dotted).
 */

function lane(over: Partial<SubUniverseMatchedVia>): SubUniverseMatchedVia {
  return {
    combo: "541330xR425",
    naics_code: "541330",
    psc_code: "R425",
    naics_title: "Engineering Services",
    psc_title: "Engineering Support",
    farmout_amt_60mo: 5_000_000,
    median_chunk_60mo: 250_000,
    median_chunk_lifetime: 200_000,
    n_subawards_lifetime: 40,
    n_distinct_subs_60mo: 8,
    last_action_date: "2026-05-01",
    anchor_uei: "UEIANCHOR001",
    anchor_obl_60mo: 12_000_000,
    prime_backed: true,
    ...over,
  };
}

function node(over: Partial<SubUniverseNode>): SubUniverseNode {
  return {
    uei: "UEIBUYER0001",
    name: "BUYER ONE LLC",
    latitude: 38.9586,
    longitude: -77.357,
    geo_precision: "zip5",
    matched_farmout_60mo: 5_000_000,
    n_matched_combos: 1,
    matched_via: [lane({})],
    teaming: { n_sub_partners_5y: 12, deepest_repeat_edges_5y: 4, n_partners_ge_3_edges: 2 },
    vehicles: [{ parent_piid: "PIID_A", farmout_amt_60mo: 1_000_000, last_action_date: null }],
    ...over,
  };
}

/** All gates off — the null baseline every test perturbs one gate from. */
const OFF: SubUniverseGateParams = {
  mvsUsd: null,
  repeatK: null,
  vehiclePiids: null,
  primeBackedOnly: false,
  combos: null,
};

function target(over: Partial<SubUniverseTarget>): SubUniverseTarget {
  return {
    uei: "UEITARGET001",
    anchors: [],
    demonstrated_combos: [],
    pop_states: [],
    vehicles: [],
    prime_combos: [],
    defaults: { mvs_usd: 150_000, repeat_k: 3, pop_states: ["VA"], window: "60mo" },
    ...over,
  };
}

/** Deterministic fake projector: inside a synthetic canvas unless lat < 0. */
function fakeProject(lon: number, lat: number): { x: number; y: number } | null {
  if (lat < 0) return null; // "outside the composite"
  return { x: lon + 200, y: lat * 2 };
}

describe("evaluateNode", () => {
  it("all gates off → lit with no reasons", () => {
    expect(evaluateNode(node({}), OFF)).toEqual({ status: "lit", reasons: [] });
  });

  it("MVS floor lights when SOME lane's median chunk clears it", () => {
    const n = node({
      matched_via: [
        lane({ combo: "A", median_chunk_60mo: 50_000, median_chunk_lifetime: null }),
        lane({ combo: "B", median_chunk_60mo: 300_000 }),
      ],
    });
    expect(evaluateNode(n, { ...OFF, mvsUsd: 250_000 }).status).toBe("lit");
  });

  it("MVS floor dims with the best-chunk reason when every lane is below", () => {
    const n = node({
      matched_via: [
        lane({ combo: "A", median_chunk_60mo: 50_000 }),
        lane({ combo: "B", median_chunk_60mo: null, median_chunk_lifetime: 120_000 }),
      ],
    });
    const ev = evaluateNode(n, { ...OFF, mvsUsd: 250_000 });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["below $250K floor — best median chunk $120K"]);
  });

  it("MVS falls back to median_chunk_lifetime when 60mo is null", () => {
    const n = node({
      matched_via: [lane({ median_chunk_60mo: null, median_chunk_lifetime: 400_000 })],
    });
    expect(evaluateNode(n, { ...OFF, mvsUsd: 250_000 }).status).toBe("lit");
  });

  it("MVS dims with 'no disclosed chunk medians' when nothing is disclosed", () => {
    const n = node({
      matched_via: [lane({ median_chunk_60mo: null, median_chunk_lifetime: null })],
    });
    const ev = evaluateNode(n, { ...OFF, mvsUsd: 250_000 });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["no disclosed chunk medians"]);
  });

  it("MVS is scoped to the selected combos when the combo filter is set", () => {
    const n = node({
      matched_via: [
        lane({ combo: "A", median_chunk_60mo: 500_000 }), // clears, but not selected
        lane({ combo: "B", median_chunk_60mo: 50_000 }),
      ],
    });
    const ev = evaluateNode(n, { ...OFF, mvsUsd: 250_000, combos: ["B"] });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["below $250K floor — best median chunk $50K"]);
  });

  it("repeat depth gates on teaming.deepest_repeat_edges_5y", () => {
    const shallow = node({
      teaming: { n_sub_partners_5y: 5, deepest_repeat_edges_5y: 2, n_partners_ge_3_edges: 0 },
    });
    const ev = evaluateNode(shallow, { ...OFF, repeatK: 3 });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["no sub partner with >=3 repeat edges (deepest: 2)"]);
    expect(evaluateNode(node({}), { ...OFF, repeatK: 3 }).status).toBe("lit"); // deepest 4
  });

  it("vehicle gate needs some node vehicle in the selected PIIDs", () => {
    const ev = evaluateNode(node({}), { ...OFF, vehiclePiids: ["PIID_Z"] });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["no disclosed sub $ under selected vehicles"]);
    expect(evaluateNode(node({}), { ...OFF, vehiclePiids: ["PIID_A", "PIID_Z"] }).status).toBe(
      "lit",
    );
  });

  it("prime-backed gate needs some prime-backed lane", () => {
    const unbacked = node({ matched_via: [lane({ prime_backed: false })] });
    const ev = evaluateNode(unbacked, { ...OFF, primeBackedOnly: true });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual(["no prime-backed lane overlap"]);
    expect(evaluateNode(node({}), { ...OFF, primeBackedOnly: true }).status).toBe("lit");
  });

  it("combo gate needs some matched lane in the selected set", () => {
    const ev = evaluateNode(node({}), { ...OFF, combos: ["999999xZ999"] });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toContain("no overlap with selected combos");
    expect(evaluateNode(node({}), { ...OFF, combos: ["541330xR425"] }).status).toBe("lit");
  });

  it("a node failing multiple gates accumulates ALL reasons", () => {
    const n = node({
      matched_via: [lane({ median_chunk_60mo: 10_000, median_chunk_lifetime: null })],
      teaming: { n_sub_partners_5y: 1, deepest_repeat_edges_5y: 1, n_partners_ge_3_edges: 0 },
      vehicles: [],
    });
    const ev = evaluateNode(n, {
      mvsUsd: 250_000,
      repeatK: 3,
      vehiclePiids: ["PIID_Z"],
      primeBackedOnly: false,
      combos: null,
    });
    expect(ev.status).toBe("dim");
    expect(ev.reasons).toEqual([
      "below $250K floor — best median chunk $10K",
      "no sub partner with >=3 repeat edges (deepest: 1)",
      "no disclosed sub $ under selected vehicles",
    ]);
  });
});

describe("defaultGateParams", () => {
  it("seeds MVS + repeat-K from target.defaults; filters start off", () => {
    expect(defaultGateParams(target({}))).toEqual({
      mvsUsd: 150_000,
      repeatK: 3,
      vehiclePiids: null,
      primeBackedOnly: false,
      combos: null,
    });
  });

  it("a null mvs_usd default keeps the MVS gate off", () => {
    const t = target({});
    t.defaults = { ...t.defaults, mvs_usd: null };
    expect(defaultGateParams(t).mvsUsd).toBeNull();
  });
});

describe("plotSubUniverse", () => {
  it("plots nodes with coordinates and drops ungeocoded nodes to unplotted", () => {
    const nodes = [
      node({ uei: "N1", latitude: 38.9586, longitude: -77.357 }),
      node({ uei: "N2", latitude: null, longitude: null }),
    ];
    const plot = plotSubUniverse(nodes, fakeProject);
    expect(plot.plotted.map((n) => n.uei)).toEqual(["N1"]);
    expect(plot.plotted[0]?.x).toBeCloseTo(-77.357 + 200);
    expect(plot.plotted[0]?.y).toBeCloseTo(38.9586 * 2);
    expect(plot.unplotted.map((n) => n.uei)).toEqual(["N2"]);
  });

  it("drops nodes the projector cannot place (outside the composite)", () => {
    const plot = plotSubUniverse(
      [node({ uei: "GUAM", latitude: -13.5, longitude: 144.8 })],
      fakeProject,
    );
    expect(plot.plotted).toEqual([]);
    expect(plot.unplotted.map((n) => n.uei)).toEqual(["GUAM"]);
  });

  it("uses the real Albers projector by default (DC-area point lands on canvas)", () => {
    const plot = plotSubUniverse([node({})]);
    expect(plot.plotted).toHaveLength(1);
    const { x, y } = plot.plotted[0] as { x: number; y: number };
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1000);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(590);
  });
});

describe("buildSubUniverseLayer", () => {
  it("evaluates EVERY node (plotted and unplotted) — dims counted, never removed", () => {
    const nodes = [
      node({ uei: "LIT1" }),
      node({
        uei: "DIM1",
        teaming: { n_sub_partners_5y: 1, deepest_repeat_edges_5y: 0, n_partners_ge_3_edges: 0 },
      }),
      node({ uei: "NOGEO", latitude: null, longitude: null }),
    ];
    const layer = buildSubUniverseLayer(nodes, { ...OFF, repeatK: 3 }, fakeProject);
    expect(layer.plotted.map((n) => n.uei)).toEqual(["LIT1", "DIM1"]); // dim stays plotted
    expect(layer.plotted[1]?.evaluation.status).toBe("dim");
    expect(layer.unplotted.map((n) => n.uei)).toEqual(["NOGEO"]);
    expect(layer.unplotted[0]?.evaluation.status).toBe("lit");
    expect(layer.litCount).toBe(2); // LIT1 + NOGEO — counts span ALL nodes
    expect(layer.dimCount).toBe(1);
  });
});

describe("comboOptions / vehicleOptions", () => {
  it("puts the target's demonstrated combos first, then top node combos by $, deduped", () => {
    const t = target({
      demonstrated_combos: [
        {
          combo: "541330xR425",
          naics_code: "541330",
          psc_code: "R425",
          n_edges: 5,
          total_usd: 1_000_000,
          median_chunk_usd: 200_000,
          last_action_date: null,
        },
      ],
    });
    const nodes = [
      node({
        matched_via: [
          lane({ combo: "541330xR425", farmout_amt_60mo: 1 }),
          lane({ combo: "SMALL", farmout_amt_60mo: 10 }),
          lane({ combo: "BIG", farmout_amt_60mo: 1_000 }),
        ],
      }),
    ];
    expect(comboOptions(t, nodes)).toEqual(["541330xR425", "BIG", "SMALL"]);
  });

  it("caps the node-derived combo tail at topN", () => {
    const lanes = Array.from({ length: 20 }, (_, i) =>
      lane({ combo: `C${i}`, farmout_amt_60mo: 1_000 - i }),
    );
    const opts = comboOptions(target({}), [node({ matched_via: lanes })], 15);
    expect(opts).toHaveLength(15);
    expect(opts[0]).toBe("C0"); // highest $
  });

  it("unions target vehicle PIIDs with top node PIIDs, deduped", () => {
    const t = target({ vehicles: [{ parent_piid: "PIID_T", sub_usd: 9 }] });
    const nodes = [
      node({
        vehicles: [
          { parent_piid: "PIID_T", farmout_amt_60mo: 5, last_action_date: null },
          { parent_piid: "PIID_N", farmout_amt_60mo: 50, last_action_date: null },
        ],
      }),
    ];
    expect(vehicleOptions(t, nodes)).toEqual(["PIID_T", "PIID_N"]);
  });
});
