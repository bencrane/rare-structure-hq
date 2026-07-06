/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import {
  type WorkbenchCatalog,
  type WorkbenchFieldDef,
  type WorkbenchRow,
  codeTypeForField,
  composeFilters,
  createRow,
  rowIsBlank,
  valueEditorKind,
  visibleWorkbenchDatasets,
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
  prime_naics: { name: "prime_naics", type: "list", ops: ["has", "has_any"], enum: null },
  sub_psc: { name: "sub_psc", type: "list", ops: ["has", "has_any"], enum: null },
  naics_code: { name: "naics_code", type: "string", ops: ["=", "in"], enum: null },
};

function row(partial: Partial<WorkbenchRow>): WorkbenchRow {
  return { ...createRow(), ...partial };
}

/** Minimal catalog literal — only the axes visibleWorkbenchDatasets reads. */
function catalog(datasets: Record<string, { legacy?: boolean }>): WorkbenchCatalog {
  return {
    datasets: Object.fromEntries(
      Object.entries(datasets).map(([k, v]) => [
        k,
        { decoderVersion: "test", fields: [], aggregate: null, ...v },
      ]),
    ),
  };
}

describe("visibleWorkbenchDatasets", () => {
  it("hides legacy datasets and leads with entities", () => {
    const tabs = visibleWorkbenchDatasets(
      catalog({
        entities: { legacy: false },
        company: { legacy: true },
        winners: { legacy: true },
        awards: { legacy: true },
        active: { legacy: true },
        contracts: { legacy: true },
      }),
    );
    expect(tabs.map((t) => t.key)).toEqual(["entities"]);
    expect(tabs[0].label).toBe("Entities");
  });

  it("keeps every non-legacy dataset present, in static tab order", () => {
    const tabs = visibleWorkbenchDatasets(
      catalog({ company: { legacy: true }, entities: {}, winners: {} }),
    );
    expect(tabs.map((t) => t.key)).toEqual(["entities", "winners"]);
  });

  it("degrades a stale payload (no entities, no legacy flags) to the old five tabs", () => {
    const tabs = visibleWorkbenchDatasets(
      catalog({ company: {}, winners: {}, awards: {}, active: {}, contracts: {} }),
    );
    expect(tabs.map((t) => t.key)).toEqual(["company", "winners", "awards", "active", "contracts"]);
  });

  it("shows legacy datasets rather than a blank strip when ALL present datasets are legacy", () => {
    const tabs = visibleWorkbenchDatasets(
      catalog({ company: { legacy: true }, awards: { legacy: true } }),
    );
    expect(tabs.map((t) => t.key)).toEqual(["company", "awards"]);
  });

  it("falls back to the full static list when the catalog is null or degenerate", () => {
    expect(visibleWorkbenchDatasets(null).map((t) => t.key)).toEqual([
      "entities",
      "company",
      "winners",
      "awards",
      "active",
      "contracts",
    ]);
    expect(visibleWorkbenchDatasets(catalog({})).map((t) => t.key)).toEqual([
      "entities",
      "company",
      "winners",
      "awards",
      "active",
      "contracts",
    ]);
  });
});

describe("codeTypeForField", () => {
  it("maps the lane pseudo-fields and plain code dimensions to their registry", () => {
    expect(codeTypeForField("prime_naics")).toBe("naics");
    expect(codeTypeForField("sub_naics")).toBe("naics");
    expect(codeTypeForField("naics_code")).toBe("naics");
    expect(codeTypeForField("prime_psc")).toBe("psc");
    expect(codeTypeForField("sub_psc")).toBe("psc");
    expect(codeTypeForField("psc_code")).toBe("psc");
  });

  it("returns null for everything else", () => {
    expect(codeTypeForField("state_code")).toBeNull();
    expect(codeTypeForField("naics")).toBeNull(); // not one of the registry field names
    expect(codeTypeForField("total_obligated")).toBeNull();
  });
});

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

  it("routes NAICS/PSC code fields to the typeahead editors", () => {
    expect(valueEditorKind(FIELDS.prime_naics, "has_any")).toBe("code-multi");
    expect(valueEditorKind(FIELDS.prime_naics, "has")).toBe("code-single");
    expect(valueEditorKind(FIELDS.sub_psc, "has_any")).toBe("code-multi");
    expect(valueEditorKind(FIELDS.naics_code, "in")).toBe("code-multi");
    expect(valueEditorKind(FIELDS.naics_code, "=")).toBe("code-single");
  });

  it("lets a wire-published enum win over the code-field name heuristic", () => {
    const enumCodeField: WorkbenchFieldDef = {
      name: "naics_code",
      type: "string",
      ops: ["=", "in"],
      enum: ["541511", "541512"],
    };
    expect(valueEditorKind(enumCodeField, "in")).toBe("enum-multi");
    expect(valueEditorKind(enumCodeField, "=")).toBe("enum-single");
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

  it("composes code fields from chips, folding in a typed-but-not-entered exact code", () => {
    const { filters, incompleteIds } = composeFilters(
      [
        // multi: chips + pending input text, deduped
        row({
          field: "prime_naics",
          op: "has_any",
          values: ["541511", "236220"],
          value: " 541512 ",
        }),
        // single: one chip
        row({ field: "naics_code", op: "=", values: ["541511"], value: "" }),
        // single with ONLY pending text — the typed exact code still runs
        row({ field: "sub_psc", op: "has", values: [], value: "R425" }),
      ],
      FIELDS,
    );
    expect(incompleteIds).toEqual([]);
    expect(filters).toEqual([
      { field: "prime_naics", op: "has_any", value: ["541511", "236220", "541512"] },
      { field: "naics_code", op: "=", value: "541511" },
      { field: "sub_psc", op: "has", value: "R425" },
    ]);
  });

  it("blocks a code row with no chips and no typed code", () => {
    const { filters, incompleteIds } = composeFilters(
      [row({ id: "empty-code", field: "prime_naics", op: "has_any", values: [], value: "  " })],
      FIELDS,
    );
    expect(filters).toEqual([]);
    expect(incompleteIds).toEqual(["empty-code"]);
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
