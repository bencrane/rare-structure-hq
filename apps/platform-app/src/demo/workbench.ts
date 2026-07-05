/**
 * Query workbench — pure types + filter-composition logic (no React, no fetch).
 *
 * The workbench is the operator's testing surface for the DETERMINISTIC federal map
 * query engine: Clay-style rows of "Where <field> <op> <value>" composed explicitly
 * against the catalyst field catalog — no LLM, no sentence routing. This module owns
 * the load-bearing logic behind that surface:
 *
 *   - the field-catalog wire types (`/api/v1/federal/query-fields`)
 *   - the row model the UI edits (`WorkbenchRow` — raw strings, never pre-cast)
 *   - `valueEditorKind` — which value editor a (field, op) pair gets
 *   - `composeFilters` — rows → the exact `{field, op, value}[]` the POST body carries
 *
 * Composition is HONEST by construction: a row with a field but an incomplete value
 * blocks the run (surfaced per-row) rather than being silently dropped, and the exact
 * composed JSON is displayed next to the results. Anything the engine rejects comes
 * back as catalyst's 422 detail and is rendered verbatim — never swallowed.
 */

// ── Datasets ─────────────────────────────────────────────────────────────────

/** The five concrete serving datasets, in tab order. Keys are the wire values of
 * `POST /api/v1/federal/query/:dataset`; labels are the tab captions. No AUTO —
 * the workbench is the deterministic path only. */
export const WORKBENCH_DATASETS = [
  { key: "company", label: "Companies" },
  { key: "winners", label: "Winners" },
  { key: "awards", label: "Awards" },
  { key: "active", label: "Active" },
  { key: "contracts", label: "Contracts" },
] as const;

export type WorkbenchDataset = (typeof WORKBENCH_DATASETS)[number]["key"];

/** Rows-per-run bound sent in the POST body (the engine also caps server-side). */
export const WORKBENCH_LIMIT = 200;

// ── Field catalog wire types (GET /query-fields) ─────────────────────────────

export type WorkbenchFieldType = "string" | "int" | "float" | "bool" | "days_ago" | "list";

export type WorkbenchOp = "=" | ">=" | "<=" | "in" | "between" | "has" | "has_any";

/** One queryable field as published by catalyst's decoder for a dataset. */
export type WorkbenchFieldDef = {
  name: string;
  type: WorkbenchFieldType;
  /** The ops THIS field supports — the op dropdown is constrained to exactly these. */
  ops: WorkbenchOp[];
  /** Allowed values (closed vocabulary) or null for open-valued fields. */
  enum: string[] | null;
  index?: string | null;
  gated?: boolean;
};

export type WorkbenchDatasetCatalog = {
  decoderVersion: string;
  fields: WorkbenchFieldDef[];
  aggregate: Record<string, unknown> | null;
};

/** The full catalog: dataset key → its fields. Populated ONLY from the wire. */
export type WorkbenchCatalog = {
  datasets: Record<string, WorkbenchDatasetCatalog>;
};

// ── Row model ────────────────────────────────────────────────────────────────

/**
 * One filter row as the UI edits it. All values are RAW input strings — casting to
 * the wire types happens once, in `composeFilters`, so the inputs never fight the
 * operator mid-keystroke.
 */
export type WorkbenchRow = {
  id: string;
  /** Field name from the catalog; "" = blank row (ignored at compose time). */
  field: string;
  /** Op; "" defaults to the field's first supported op at compose time. */
  op: WorkbenchOp | "";
  /** Scalar input / `between` lower bound / comma-separated list for open in|has_any. */
  value: string;
  /** `between` upper bound. */
  value2: string;
  /** Selected enum values for multi-select (in|has_any on a closed vocabulary). */
  values: string[];
};

let rowSeq = 0;

/** A fresh blank row. Ids are session-unique (list keys + incompleteness reporting). */
export function createRow(): WorkbenchRow {
  rowSeq += 1;
  return { id: `wb-row-${rowSeq}`, field: "", op: "", value: "", value2: "", values: [] };
}

// ── Value editor selection ───────────────────────────────────────────────────

/** Which value editor a (field, op) pair gets. */
export type ValueEditorKind =
  | "enum-multi" // in | has_any on a closed vocabulary → multi-select chips
  | "enum-single" // scalar op on a closed vocabulary → single select
  | "between" // two numeric bounds
  | "bool" // true/false select
  | "number" // int | float | days_ago scalar
  | "text-list" // in | has_any on an open vocabulary → comma-separated text
  | "text"; // open string / list `has`

export function valueEditorKind(field: WorkbenchFieldDef, op: WorkbenchOp): ValueEditorKind {
  if (op === "between") return "between";
  const multi = op === "in" || op === "has_any";
  if (field.enum && field.enum.length > 0) return multi ? "enum-multi" : "enum-single";
  if (multi) return "text-list";
  if (field.type === "bool") return "bool";
  if (field.type === "int" || field.type === "float" || field.type === "days_ago") return "number";
  return "text";
}

// ── Composition ──────────────────────────────────────────────────────────────

/** One composed wire filter — exactly what the POST body carries. */
export type ComposedFilter = { field: string; op: WorkbenchOp; value: unknown };

export type ComposeResult = {
  filters: ComposedFilter[];
  /** Row ids with a field selected but an unusable value — these BLOCK the run
   * (rendered per-row), so a half-built condition is never silently dropped. */
  incompleteIds: string[];
};

/** A row with no field selected is a blank scaffold row, not an incomplete filter. */
export function rowIsBlank(row: WorkbenchRow): boolean {
  return row.field === "";
}

/** Cast one raw input string to the field's wire scalar; null = unusable. */
function castScalar(type: WorkbenchFieldType, raw: string): string | number | boolean | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (type === "int" || type === "float" || type === "days_ago") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "bool") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return null;
  }
  return trimmed;
}

/**
 * Compose the wire filters from the edited rows.
 *
 * - blank rows (no field) are skipped;
 * - a row whose field is missing from the catalog, or whose value doesn't cast,
 *   lands in `incompleteIds` and produces no filter;
 * - `op` defaults to the field's first supported op when unset.
 */
export function composeFilters(
  rows: WorkbenchRow[],
  fields: Record<string, WorkbenchFieldDef>,
): ComposeResult {
  const filters: ComposedFilter[] = [];
  const incompleteIds: string[] = [];

  for (const row of rows) {
    if (rowIsBlank(row)) continue;
    const def = fields[row.field];
    if (!def || def.ops.length === 0) {
      incompleteIds.push(row.id);
      continue;
    }
    const op: WorkbenchOp = row.op !== "" && def.ops.includes(row.op) ? row.op : def.ops[0];
    const kind = valueEditorKind(def, op);

    if (kind === "between") {
      const lo = castScalar(def.type, row.value);
      const hi = castScalar(def.type, row.value2);
      if (typeof lo !== "number" || typeof hi !== "number") {
        incompleteIds.push(row.id);
        continue;
      }
      filters.push({ field: def.name, op, value: [lo, hi] });
      continue;
    }

    if (kind === "enum-multi") {
      const picked = row.values.filter((v) => v !== "");
      if (picked.length === 0) {
        incompleteIds.push(row.id);
        continue;
      }
      filters.push({ field: def.name, op, value: picked });
      continue;
    }

    if (kind === "text-list") {
      const parts = row.value
        .split(",")
        .map((p) => castScalar(def.type, p))
        .filter((p): p is string | number | boolean => p !== null);
      if (parts.length === 0) {
        incompleteIds.push(row.id);
        continue;
      }
      filters.push({ field: def.name, op, value: parts });
      continue;
    }

    // enum-single | bool | number | text — one scalar, cast by the field's type.
    const scalar = castScalar(def.type, row.value);
    if (scalar === null) {
      incompleteIds.push(row.id);
      continue;
    }
    filters.push({ field: def.name, op, value: scalar });
  }

  return { filters, incompleteIds };
}
