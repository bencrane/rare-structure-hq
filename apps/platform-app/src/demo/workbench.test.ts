/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import {
  type WorkbenchFieldDef,
  type WorkbenchRow,
  composeFilters,
  createRow,
  rowIsBlank,
  valueEditorKind,
} from "./workbench";

/**
 * Guards the workbench's load-bearing seam: rows → the exact wire filters the POST
 * body carries. The contract is honesty — blank rows are scaffolding (skipped),
 * half-built rows BLOCK the run (never silently dropped), and every value is cast
 * to the field's wire type exactly once.
 */

const FIELDS: Record<string, WorkbenchFieldDef> = {
  state_code: { name: "state_code", type: "string", ops: ["=", "in"], enum: ["VA", "MD", "TX"] },
  total_obligated: {
    name: "total_obligated",
    type: "float",
    ops: [">=", "<=", "between"],
    enum: null,
  },
  award_count: { name: "award_count", type: "int", ops: [">=", "<="], enum: null },
  is_active: { name: "is_active", type: "bool", ops: ["="], enum: null },
  last_action: { name: "last_action", type: "days_ago", ops: ["<=", ">="], enum: null },
  naics: { name: "naics", type: "string", ops: ["=", "in"], enum: null },
  capabilities: { name: "capabilities", type: "list", ops: ["has", "has_any"], enum: null },
};

function row(partial: Partial<WorkbenchRow>): WorkbenchRow {
  return { ...createRow(), ...partial };
}

describe("valueEditorKind", () => {
  it("routes each (field, op) pair to the right editor", () => {
    expect(valueEditorKind(FIELDS.state_code, "=")).toBe("enum-single");
    expect(valueEditorKind(FIELDS.state_code, "in")).toBe("enum-multi");
    expect(valueEditorKind(FIELDS.total_obligated, "between")).toBe("between");
    expect(valueEditorKind(FIELDS.total_obligated, ">=")).toBe("number");
    expect(valueEditorKind(FIELDS.award_count, "<=")).toBe("number");
    expect(valueEditorKind(FIELDS.last_action, "<=")).toBe("number");
    expect(valueEditorKind(FIELDS.is_active, "=")).toBe("bool");
    expect(valueEditorKind(FIELDS.naics, "=")).toBe("text");
    expect(valueEditorKind(FIELDS.naics, "in")).toBe("text-list");
    expect(valueEditorKind(FIELDS.capabilities, "has")).toBe("text");
    expect(valueEditorKind(FIELDS.capabilities, "has_any")).toBe("text-list");
  });
});

describe("composeFilters", () => {
  it("casts scalars to the field's wire type", () => {
    const { filters, incompleteIds } = composeFilters(
      [
        row({ field: "total_obligated", op: ">=", value: "1000000" }),
        row({ field: "is_active", op: "=", value: "true" }),
        row({ field: "last_action", op: "<=", value: "90" }),
        row({ field: "naics", op: "=", value: " 541511 " }),
      ],
      FIELDS,
    );
    expect(incompleteIds).toEqual([]);
    expect(filters).toEqual([
      { field: "total_obligated", op: ">=", value: 1_000_000 },
      { field: "is_active", op: "=", value: true },
      { field: "last_action", op: "<=", value: 90 },
      { field: "naics", op: "=", value: "541511" },
    ]);
  });

  it("composes enum multi-select and open comma-lists into arrays", () => {
    const { filters } = composeFilters(
      [
        row({ field: "state_code", op: "in", values: ["VA", "TX"] }),
        row({ field: "naics", op: "in", value: "541511, 541512 ,," }),
        row({ field: "capabilities", op: "has_any", value: "electrical_systems, hvac" }),
      ],
      FIELDS,
    );
    expect(filters).toEqual([
      { field: "state_code", op: "in", value: ["VA", "TX"] },
      { field: "naics", op: "in", value: ["541511", "541512"] },
      { field: "capabilities", op: "has_any", value: ["electrical_systems", "hvac"] },
    ]);
  });

  it("composes between as a two-number array and blocks half-filled bounds", () => {
    const ok = composeFilters(
      [row({ id: "a", field: "total_obligated", op: "between", value: "1000", value2: "5000" })],
      FIELDS,
    );
    expect(ok.filters).toEqual([{ field: "total_obligated", op: "between", value: [1000, 5000] }]);

    const half = composeFilters(
      [row({ id: "b", field: "total_obligated", op: "between", value: "1000", value2: "" })],
      FIELDS,
    );
    expect(half.filters).toEqual([]);
    expect(half.incompleteIds).toEqual(["b"]);
  });

  it("skips blank rows but blocks rows with a field and no usable value", () => {
    const blank = row({});
    expect(rowIsBlank(blank)).toBe(true);

    const { filters, incompleteIds } = composeFilters(
      [
        blank,
        row({ id: "empty-value", field: "naics", op: "=", value: "  " }),
        row({ id: "bad-number", field: "award_count", op: ">=", value: "lots" }),
        row({ id: "no-picks", field: "state_code", op: "in", values: [] }),
        row({ id: "unknown-field", field: "ghost", op: "=", value: "x" }),
      ],
      FIELDS,
    );
    expect(filters).toEqual([]);
    expect(incompleteIds).toEqual(["empty-value", "bad-number", "no-picks", "unknown-field"]);
  });

  it("defaults an unset or unsupported op to the field's first supported op", () => {
    const { filters } = composeFilters(
      [
        row({ field: "state_code", op: "", value: "VA" }),
        // "between" is not in state_code's ops — falls back to its first op ("=").
        row({ field: "state_code", op: "between", value: "MD", value2: "TX" }),
      ],
      FIELDS,
    );
    expect(filters).toEqual([
      { field: "state_code", op: "=", value: "VA" },
      { field: "state_code", op: "=", value: "MD" },
    ]);
  });
});
