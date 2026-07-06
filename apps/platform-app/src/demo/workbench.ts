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

/** The concrete serving datasets, in tab order (the Gen-3 tables first: entities,
 * prime_awards, transactions). Keys are the wire values of
 * `POST /api/v1/federal/query/:dataset`; labels are the tab captions.
 * No AUTO — the workbench is the deterministic path only. WHICH of these actually
 * render as tabs is decided by `visibleWorkbenchDatasets` from the fetched catalog
 * (legacy datasets are hidden), never by this static list alone. */
export const WORKBENCH_DATASETS = [
  { key: "entities", label: "Entities" },
  { key: "prime_awards", label: "Prime Awards" },
  { key: "transactions", label: "Transactions" },
  { key: "company", label: "Companies" },
  { key: "winners", label: "Winners" },
  { key: "awards", label: "Awards" },
  { key: "active", label: "Active" },
  { key: "contracts", label: "Contracts" },
] as const;

export type WorkbenchDataset = (typeof WORKBENCH_DATASETS)[number]["key"];

export type WorkbenchDatasetTab = { key: WorkbenchDataset; label: string };

/**
 * The dataset tabs to render, derived from the FETCHED catalog:
 *
 *   - datasets absent from the payload are hidden (nothing to query);
 *   - `legacy: true` datasets are hidden outright — no toggle; the workbench fronts
 *     the current engine, not the retiring serving tables;
 *   - NEVER a blank strip: if every present dataset is legacy (or the payload is
 *     degenerate/stale), fall back to showing what exists rather than nothing.
 *
 * A stale catalyst payload (no `entities`, no `legacy` flags) therefore degrades to
 * exactly the old five-tab behaviour — absent flags read as non-legacy.
 */
export function visibleWorkbenchDatasets(catalog: WorkbenchCatalog | null): WorkbenchDatasetTab[] {
  if (!catalog) return [...WORKBENCH_DATASETS];
  const present = WORKBENCH_DATASETS.filter((d) => catalog.datasets[d.key]);
  if (present.length === 0) return [...WORKBENCH_DATASETS];
  const nonLegacy = present.filter((d) => !catalog.datasets[d.key].legacy);
  return nonLegacy.length > 0 ? [...nonLegacy] : [...present];
}

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
  /** Code registry this field's values live in — the PRIMARY typeahead signal.
   * Absent on stale payloads; the field-name heuristic then covers the known set. */
  codes?: CodeRegistry;
  index?: string | null;
  gated?: boolean;
};

export type WorkbenchDatasetCatalog = {
  decoderVersion: string;
  fields: WorkbenchFieldDef[];
  aggregate: Record<string, unknown> | null;
  /** True on the retiring Gen-2 serving tables (winners/company/awards/active/contracts);
   * false on `entities`. Absent on a stale catalyst payload — read as non-legacy. */
  legacy?: boolean;
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
  | "code-multi" // in | has_any on a code-registry field → typeahead chips
  | "code-single" // scalar op on a code-registry field → typeahead, one chip
  | "between" // two numeric bounds
  | "bool" // true/false select
  | "number" // int | float | days_ago scalar
  | "text-list" // in | has_any on an open vocabulary → comma-separated text
  | "text"; // open string / list `has`

/** The code registries the typeahead can search (`/federal/query-codes?type=…`). */
export type CodeRegistry = "naics" | "psc" | "agency";

/** FALLBACK name heuristic — the known code fields for payloads that predate the
 * per-field `codes` attribute (stale catalyst). Never extended: new code fields are
 * declared by the payload, not by name-matching here. */
const CODE_FIELDS_BY_NAME: Record<string, CodeRegistry> = {
  prime_naics: "naics",
  sub_naics: "naics",
  naics_code: "naics",
  prime_psc: "psc",
  sub_psc: "psc",
  psc_code: "psc",
};

/** The code registry a field's values live in, or null for non-code fields.
 * The payload's `codes` attribute is the PRIMARY signal (any field carrying it gets
 * the typeahead, e.g. `top_agency_code` → "agency"); the name heuristic remains only
 * so behavior never regresses against a stale payload without the attribute. */
export function codeRegistryForField(
  field: Pick<WorkbenchFieldDef, "name" | "codes">,
): CodeRegistry | null {
  return field.codes ?? CODE_FIELDS_BY_NAME[field.name] ?? null;
}

export function valueEditorKind(field: WorkbenchFieldDef, op: WorkbenchOp): ValueEditorKind {
  if (op === "between") return "between";
  const multi = op === "in" || op === "has_any";
  // A wire-published enum is authoritative — the server's closed set wins even when
  // the field ALSO carries `codes` (an enum'd code field renders as a plain enum picker).
  if (field.enum && field.enum.length > 0) return multi ? "enum-multi" : "enum-single";
  if (codeRegistryForField(field)) return multi ? "code-multi" : "code-single";
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

    if (kind === "code-multi" || kind === "code-single") {
      // Chips (row.values) plus any exact code still sitting in the search input —
      // a typed-but-not-entered code runs rather than being silently lost.
      const picked = row.values.filter((v) => v !== "");
      const pending = row.value.trim();
      if (pending !== "" && !picked.includes(pending)) picked.push(pending);
      if (picked.length === 0) {
        incompleteIds.push(row.id);
        continue;
      }
      filters.push({
        field: def.name,
        op,
        value: kind === "code-multi" ? picked : picked[0],
      });
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
