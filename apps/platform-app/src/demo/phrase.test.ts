/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { bindingLabel, planStepToComposer } from "./phrase";

describe("planStepToComposer", () => {
  it("maps scalar / in-list / between / boolean filters onto composer rows", () => {
    const { dataset, rows } = planStepToComposer({
      grain: "transaction",
      filters: [
        { field: "action_type_code", op: "=", value: "A" },
        { field: "naics_code", op: "in", value: ["236220", "237310"] },
        { field: "action_date", op: "between", value: [552, 917] },
        { field: "in_dsbs", op: "=", value: true },
      ],
      limit: 1000,
    });
    expect(dataset).toBe("transactions");
    expect(rows.map((r) => [r.field, r.op, r.value, r.value2])).toEqual([
      ["action_type_code", "=", "A", ""],
      ["naics_code", "in", "236220, 237310", ""],
      ["action_date", "between", "552", "917"],
      ["in_dsbs", "=", "true", ""],
    ]);
  });

  it("maps grains to dataset tabs and never returns zero rows", () => {
    expect(planStepToComposer({ grain: "entity", filters: [], limit: 1 }).dataset).toBe("entities");
    expect(planStepToComposer({ grain: "prime_award", filters: [], limit: 1 }).dataset).toBe(
      "prime_awards",
    );
    expect(planStepToComposer({ grain: "entity", filters: [], limit: 1 }).rows).toHaveLength(1);
  });
});

describe("bindingLabel", () => {
  it("renders bound axes, hides connectives, truncates long lists", () => {
    expect(bindingLabel({ tokens: ["that"], axis: "connective", op: null, value: null })).toBe("");
    expect(
      bindingLabel({ tokens: ["code", "a", "mod"], axis: "action_type", op: "=", value: "A" }),
    ).toBe("code a mod → action_type = A");
    const label = bindingLabel({
      tokens: ["construction"],
      axis: "naics",
      op: "in",
      value: ["1", "2", "3", "4", "5", "6"],
    });
    expect(label).toContain("+2");
  });
});
