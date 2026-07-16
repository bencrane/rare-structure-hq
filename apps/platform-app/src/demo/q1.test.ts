/**
 * q1.ts — pure parse/compose tests for the canonical-query typeahead.
 *
 * Exercises the slot extractor behind the ⌘K palette: won+window → Q2, `based in` vs `in`
 * (HQ vs PoP), `and need <occupation>` prefix match, the `>` navigation synonym for `over`,
 * and the leading industry token. No network — `q1Candidates` is a pure function of its input.
 */

import { describe, expect, test } from "bun:test";
import type { JtbdPhrase, Occupation } from "./federalApi";
import { q1Candidates } from "./q1";

const VOCAB: JtbdPhrase[] = [
  { phrase: "to: construct highways", combo_count: 100 },
  { phrase: "to: weld structural steel", combo_count: 90 },
  { phrase: "to: paint bridges", combo_count: 10 },
];

const OCCUPATIONS: Occupation[] = [
  { token: "welders", soc_count: 5 },
  { token: "electricians", soc_count: 4 },
  { token: "welding inspectors", soc_count: 2 },
];

/** The active-awards command shape (narrow the union for the assertions). */
type Q1 = Extract<ReturnType<typeof q1Candidates>[number], { kind: "active-awards" }>;
const q1s = (raw: string): Q1[] =>
  q1Candidates(raw, VOCAB, OCCUPATIONS).filter((c): c is Q1 => c.kind === "active-awards");

describe("mode + window (Q1 default vs Q2)", () => {
  test("empty input defaults to Q1 (active) only — never Q2", () => {
    const all = q1s("");
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.mode == null)).toBe(true);
    expect(all.some((c) => c.label.startsWith("companies with active"))).toBe(true);
  });

  test("`won` flips to Q2 and fans all 8 windows when none typed", () => {
    const rows = q1s("won total");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.mode === "won")).toBe(true);
    const windows = new Set(rows.map((c) => c.windowDays));
    for (const d of [30, 45, 60, 90, 180, 365, 730, 1095]) expect(windows.has(d)).toBe(true);
  });

  test("won + explicit window binds that window and renders it", () => {
    const [row] = q1s("won total in the last 90 days");
    expect(row.mode).toBe("won");
    expect(row.windowDays).toBe(90);
    expect(row.label).toContain("that have won total awards");
    expect(row.label).toContain("in the last 90 days");
  });

  test("year / multi-year windows render in words", () => {
    expect(q1s("won single in the last year")[0].label).toContain("in the last year");
    expect(q1s("won single in the last 2 years")[0].windowDays).toBe(730);
    expect(q1s("won single in the last 3 years")[0].label).toContain("in the last 3 years");
  });

  test("a bare window fragment (no `won`) still flips to Q2", () => {
    expect(q1s("total in the last 90 days").every((c) => c.mode === "won")).toBe(true);
  });
});

describe("based in <state> (HQ) vs in <state> (PoP)", () => {
  test("`based in` binds hqState, leaves PoP unset", () => {
    const [row] = q1s("total based in texas");
    expect(row.hqState).toBe("TX");
    expect(row.stateCode).toBeUndefined();
    expect(row.label).toContain("based in texas");
  });

  test("`in` binds PoP state", () => {
    const [row] = q1s("total in california");
    expect(row.stateCode).toBe("CA");
    expect(row.hqState).toBeUndefined();
  });

  test("both clauses coexist — PoP then HQ", () => {
    const [row] = q1s("total in california based in texas");
    expect(row.stateCode).toBe("CA");
    expect(row.hqState).toBe("TX");
    expect(row.label).toContain("in california based in texas");
  });
});

describe("and need <occupation>", () => {
  test("prefix matches the occupation vocab (verbatim token)", () => {
    const rows = q1s("total and need weld");
    const needs = new Set(rows.map((c) => c.need));
    expect(needs.has("welders")).toBe(true);
    expect(needs.has("welding inspectors")).toBe(true);
    expect(needs.has("electricians")).toBe(false);
    expect(rows[0].label).toContain("and need ");
  });

  test("bare `need` (no prefix) offers the full occupation set", () => {
    const needs = new Set(q1s("total need").map((c) => c.need));
    expect(needs.has("welders")).toBe(true);
    expect(needs.has("electricians")).toBe(true);
  });
});

describe("amount `>` / `>=` navigation synonyms", () => {
  test("`>` parses like `over`, renders as `over`", () => {
    const [row] = q1s("total > $5m");
    expect(row.minAmt).toBe(5_000_000);
    expect(row.label).toContain("over $5m");
    expect(row.label).not.toContain(">");
  });

  test("`>=` also parses the floor", () => {
    expect(q1s("total >= 500k")[0].minAmt).toBe(500_000);
  });
});

describe("Q3 event verbs", () => {
  test("a verb fragment surfaces the event family (no grain marker on rows)", () => {
    const rows = q1s("received new funding");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.mode === "events")).toBe(true);
    expect(rows.every((c) => c.eventVerb === "received new funding")).toBe(true);
    expect(rows.every((c) => c.grain == null)).toBe(true);
    expect(rows[0].label).toContain("companies that received new funding");
  });

  test("`change orders` fragment surfaces both matching verbs", () => {
    const verbs = new Set(q1s("change orders").map((c) => c.eventVerb));
    expect(verbs.has("got change orders")).toBe(true);
    expect(verbs.has("had change orders priced")).toBe(true);
  });

  test("event rows fan all 8 windows when none typed", () => {
    const windows = new Set(q1s("novated").map((c) => c.windowDays));
    for (const d of [30, 45, 60, 90, 180, 365, 730, 1095]) expect(windows.has(d)).toBe(true);
  });

  test("explicit window binds and renders on an event row", () => {
    const [row] = q1s("received new funding in the last 90 days");
    expect(row.mode).toBe("events");
    expect(row.windowDays).toBe(90);
    expect(row.label).toContain("in the last 90 days");
  });

  test("`in <state>` (PoP) is NOT offered on event rows", () => {
    const rows = q1s("received new funding in california");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.stateCode == null)).toBe(true);
    expect(rows.every((c) => !c.label.includes("in california"))).toBe(true);
  });

  test("event verb + `over $X` parses the obligation floor", () => {
    const [row] = q1s("received new funding over $10m");
    expect(row.minAmt).toBe(10_000_000);
    expect(row.mode).toBe("events");
    expect(row.label).toContain("over $10m");
  });

  test("event verb keeps industry, HQ, and need slots", () => {
    const [row] = q1s("construction were novated based in texas and need welders");
    expect(row.mode).toBe("events");
    expect(row.eventVerb).toBe("were novated");
    expect(row.industry).toBe("construction");
    expect(row.hqState).toBe("TX");
    expect(row.need).toBe("welders");
  });
});

describe("leading industry token", () => {
  test("single-word leading token binds industry", () => {
    const [row] = q1s("construction total");
    expect(row.industry).toBe("construction");
    expect(row.label.startsWith("construction companies with active total")).toBe(true);
  });

  test("multi-word `real estate` wins longest-match", () => {
    expect(q1s("real estate total")[0].industry).toBe("real estate");
  });

  test("a job word after the opener is NOT read as industry", () => {
    const rows = q1s("total weld");
    expect(rows.every((c) => c.industry == null)).toBe(true);
    expect(rows.some((c) => c.jobPhrase === "to: weld structural steel")).toBe(true);
  });
});

describe("Q4 step-growth (grew {N}x)", () => {
  test("`grew` fans all 5 multipliers × all 3 window pairs, no grain, no PoP", () => {
    const rows = q1s("grew");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.mode === "growth")).toBe(true);
    expect(rows.every((c) => c.grain == null)).toBe(true);
    expect(rows.every((c) => c.stateCode == null)).toBe(true);
    const mults = new Set(rows.map((c) => c.multiplier));
    for (const m of [2, 3, 4, 5, 10]) expect(mults.has(m)).toBe(true);
    const pairs = new Set(rows.map((c) => c.windowPair));
    for (const p of ["12v24", "6v12", "90v90"] as const) expect(pairs.has(p)).toBe(true);
  });

  test("a bare `4x` multiplier pins it and flips to growth", () => {
    const rows = q1s("grew 4x");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.mode === "growth")).toBe(true);
    expect(rows.every((c) => c.multiplier === 4)).toBe(true);
    // no window pair typed → still fans all 3
    expect(new Set(rows.map((c) => c.windowPair)).size).toBe(3);
    expect(rows[0].label).toContain("prime obligations grew 4x");
  });

  test("window pairs render exactly and pin from a `prior 24` fragment", () => {
    const rows = q1s("grew 5x in the last 12 months vs the prior 24 months");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.multiplier === 5 && c.windowPair === "12v24")).toBe(true);
    expect(rows[0].label).toContain(
      "prime obligations grew 5x in the last 12 months vs the prior 24 months",
    );
    // the 90-day pair renders in days, not months
    const days = q1s("grew 10x in the last 90 days vs the prior 90 days");
    expect(days[0].windowPair).toBe("90v90");
    expect(days[0].label).toContain("in the last 90 days vs the prior 90 days");
  });

  test("composes industry prefix + `to <job>` + `based in <state>` + `and need`", () => {
    const rows = q1s(
      "construction grew 3x in the last 6 months vs the prior 12 months to weld based in texas and need welders",
    );
    expect(rows.length).toBeGreaterThan(0);
    const [row] = rows;
    expect(row.mode).toBe("growth");
    expect(row.multiplier).toBe(3);
    expect(row.windowPair).toBe("6v12");
    expect(row.industry).toBe("construction");
    expect(row.jobPhrase).toBe("to: weld structural steel");
    expect(row.hqState).toBe("TX");
    expect(row.need).toBe("welders");
    expect(row.label).toBe(
      "construction companies whose prime obligations grew 3x in the last 6 months vs the prior 12 months to weld structural steel based in texas and need welders",
    );
  });

  test("PoP `in <state>` is never offered on growth rows", () => {
    const rows = q1s("grew 2x in california");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.mode === "growth")).toBe(true);
    expect(rows.every((c) => c.stateCode == null)).toBe(true);
    expect(rows.every((c) => !c.label.includes("in california"))).toBe(true);
  });
});
