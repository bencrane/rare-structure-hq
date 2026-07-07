/**
 * Phrase compiler client types + the plan→composer mapping (pure logic).
 *
 * The wire is catalyst's deterministic phrase compiler (phrase.v2, POST
 * /api/v1/federal/phrase, verbatim broker): a CLOSED grammar — any unbound
 * token refuses the whole phrase with a 422 naming the token, and
 * `meta.bindings` accounts for every token. v2 adds the active axis
 * (active / expiring within N days / won by UEI) and TWO-LANE plans (event
 * lane ∩ award lane → entity; `step2` discloses the second lane's collapse).
 * The workbench uses `planStepToComposer` to POPULATE its filter rows from
 * the plan's terminal step, so the phrase layer visibly compiles INTO the
 * deterministic layer the operator already drives by hand.
 */

import { type WorkbenchDataset, type WorkbenchRow, createRow } from "./workbench";

export type PhraseBinding = {
  tokens: string[];
  axis: string;
  op: string | null;
  value: unknown;
};

export type PhrasePlanStep = {
  grain: string;
  collapse?: string;
  filters: { field: string; op: string; value: unknown }[];
  limit: number;
};

export type PhraseMeta = {
  compilerVersion: string;
  registryVersion: string;
  phrase: string;
  bindings: PhraseBinding[];
  grain: string;
  plan: PhrasePlanStep[];
  refused: null | { token: string; reason: string };
  returned?: number;
  total?: number;
  capped?: boolean;
  step1?: { total_rows: number; distinct_recipients: number; scan_capped: boolean };
  /** Second collapse lane's summary — present on phrase.v2 TWO-LANE plans. */
  step2?: { total_rows: number; distinct_recipients: number; scan_capped: boolean };
};

export type PhraseResponse = {
  meta: PhraseMeta;
  data: { rows: Record<string, unknown>[] };
};

/** Compiler grain → workbench dataset tab. */
export const GRAIN_TO_DATASET: Record<string, WorkbenchDataset> = {
  entity: "entities",
  prime_award: "prime_awards",
  transaction: "transactions",
} as Record<string, WorkbenchDataset>;

/**
 * The plan's TERMINAL step → workbench composer state. Pipeline plans terminate
 * on the resolved entity step (its uei in-list included verbatim); single-step
 * plans map directly. Filter values map onto the row shape the composer already
 * uses: scalars stringify, `in` lists comma-join into `value`, `between` splits
 * across value/value2, booleans stringify lowercase.
 */
export function planStepToComposer(step: PhrasePlanStep): {
  dataset: WorkbenchDataset;
  rows: WorkbenchRow[];
} {
  const dataset = GRAIN_TO_DATASET[step.grain] ?? ("entities" as WorkbenchDataset);
  const rows = step.filters.map((f) => {
    const row = createRow();
    row.field = f.field;
    row.op = f.op as WorkbenchRow["op"];
    if (f.op === "between" && Array.isArray(f.value) && f.value.length === 2) {
      row.value = String(f.value[0]);
      row.value2 = String(f.value[1]);
    } else if (Array.isArray(f.value)) {
      row.value = f.value.map(String).join(", ");
    } else if (typeof f.value === "boolean") {
      row.value = f.value ? "true" : "false";
    } else {
      row.value = String(f.value);
    }
    return row;
  });
  return { dataset, rows: rows.length > 0 ? rows : [createRow()] };
}

/** Compact one-line rendering of a binding for the disclosure strip. */
export function bindingLabel(b: PhraseBinding): string {
  const span = b.tokens.join(" ");
  if (b.axis === "connective") return "";
  if (b.axis === "subject") return `${span} → grain:${String(b.value)}`;
  const val = Array.isArray(b.value)
    ? b.value.length > 4
      ? `[${b.value.slice(0, 4).map(String).join(",")} +${b.value.length - 4}]`
      : `[${b.value.map(String).join(",")}]`
    : typeof b.value === "object" && b.value !== null
      ? JSON.stringify(b.value)
      : String(b.value);
  return `${span} → ${b.axis}${b.op ? ` ${b.op}` : ""} ${val}`;
}
