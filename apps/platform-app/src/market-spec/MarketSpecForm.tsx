/**
 * MarketSpecForm — the market-definition instrument's left rail.
 *
 * Pure controlled UI over a `SpecDraft` (raw strings/selections); the parent
 * owns the draft and calls `buildSpec` on Run to compile it into the
 * `MarketSpec` wire shape. Section order is locked (most definitive → most
 * ambiguous): Geography → Federal $ → Designations → Firmographics. Every
 * section renders an explicit "All" until answered — "asked, and they don't
 * care" must be visible, never a blank.
 */
import { useId } from "react";

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { Panel } from "@/app/cockpit";
import { inputCls, labelCls, parseMoney, parseStates, primaryBtnCls, selectCls } from "@/market/ui";
import {
  DESIGNATION_TOKENS,
  DOLLAR_SIDES,
  DOLLAR_WINDOWS,
  type DollarSide,
  type DollarWindow,
  EMPLOYEE_BANDS,
  type GeoBasis,
  type MarketSpec,
} from "./api";

export type SpecDraft = {
  geoBasis: GeoBasis;
  states: string;
  dollarSide: DollarSide;
  dollarWindow: DollarWindow;
  dollarMin: string;
  dollarMax: string;
  designations: string[];
  employeeBands: string[];
};

export const EMPTY_SPEC_DRAFT: SpecDraft = {
  geoBasis: "hq",
  states: "",
  dollarSide: "total",
  dollarWindow: "24mo",
  dollarMin: "",
  dollarMax: "",
  designations: [],
  employeeBands: [],
};

/** Compile the raw draft into the MarketSpec wire shape (omitted = All). */
export function buildSpec(d: SpecDraft): MarketSpec {
  const spec: MarketSpec = {};
  const states = parseStates(d.states);
  if (states) spec.geo = { basis: d.geoBasis, states };
  const min = parseMoney(d.dollarMin);
  const max = parseMoney(d.dollarMax);
  if (min != null || max != null) {
    spec.dollars = { side: d.dollarSide, window: d.dollarWindow };
    if (min != null) spec.dollars.min = min;
    if (max != null) spec.dollars.max = max;
  }
  if (d.designations.length > 0) spec.designations = d.designations;
  if (d.employeeBands.length > 0) spec.firmographics = { employee_bands: d.employeeBands };
  return spec;
}

// ── Controls ─────────────────────────────────────────────────────────────────

/** The explicit rendered "All" — an answered value, not an empty input. */
function AllBadge({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        "border px-2 py-0.5 font-mono text-mono-xs uppercase tracking-[0.14em]",
        on
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-subtle)] line-through",
      )}
    >
      All
    </span>
  );
}

function Section({
  title,
  all,
  children,
}: {
  title: string;
  all: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="3">
      <Inline justify="between" align="center">
        <span className={labelCls}>{title}</span>
        <AllBadge on={all} />
      </Inline>
      {children}
    </Stack>
  );
}

function Chip({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cx(
        "border px-2 py-1 font-mono text-mono-xs uppercase tracking-[0.14em] transition-colors",
        on
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border-default)] hover:text-[color:var(--color-text-default)]",
      )}
    >
      {label}
    </button>
  );
}

const toggle = (list: string[], v: string): string[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

// ── The rail ─────────────────────────────────────────────────────────────────

export function MarketSpecForm({
  draft,
  onDraft,
  onRun,
  busy,
}: {
  draft: SpecDraft;
  onDraft: (d: SpecDraft) => void;
  onRun: () => void;
  busy: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<SpecDraft>) => onDraft({ ...draft, ...patch });

  const geoAll = parseStates(draft.states) === undefined;
  const dollarsAll = parseMoney(draft.dollarMin) == null && parseMoney(draft.dollarMax) == null;
  const desigAll = draft.designations.length === 0;
  const firmoAll = draft.employeeBands.length === 0;

  return (
    <Panel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        <Stack gap="6">
          <Section title="Geography" all={geoAll}>
            <Inline gap="2">
              {(["hq", "pop"] as const).map((b) => (
                <Chip
                  key={b}
                  on={draft.geoBasis === b}
                  label={b === "hq" ? "Based in" : "Working in"}
                  onToggle={() => set({ geoBasis: b })}
                />
              ))}
            </Inline>
            <label htmlFor={`${id}-states`} className="sr-only">
              States
            </label>
            <input
              id={`${id}-states`}
              value={draft.states}
              onChange={(e) => set({ states: e.target.value })}
              placeholder="states · TX OK LA (blank = All)"
              className={inputCls}
            />
          </Section>

          <Section title="Federal $" all={dollarsAll}>
            <Inline gap="2">
              <label htmlFor={`${id}-window`} className="sr-only">
                Window
              </label>
              <select
                id={`${id}-window`}
                value={draft.dollarWindow}
                onChange={(e) => set({ dollarWindow: e.target.value as DollarWindow })}
                className={selectCls}
              >
                {DOLLAR_WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`${id}-side`} className="sr-only">
                Side
              </label>
              <select
                id={`${id}-side`}
                value={draft.dollarSide}
                onChange={(e) => set({ dollarSide: e.target.value as DollarSide })}
                className={selectCls}
              >
                {DOLLAR_SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Inline>
            <Inline gap="2">
              <label htmlFor={`${id}-min`} className="sr-only">
                Minimum $
              </label>
              <input
                id={`${id}-min`}
                value={draft.dollarMin}
                onChange={(e) => set({ dollarMin: e.target.value })}
                placeholder="at least · 250k"
                className={inputCls}
              />
              <label htmlFor={`${id}-max`} className="sr-only">
                Maximum $
              </label>
              <input
                id={`${id}-max`}
                value={draft.dollarMax}
                onChange={(e) => set({ dollarMax: e.target.value })}
                placeholder="at most · 25m"
                className={inputCls}
              />
            </Inline>
          </Section>

          <Section title="Designations" all={desigAll}>
            <div className="flex flex-wrap gap-2">
              {DESIGNATION_TOKENS.map((t) => (
                <Chip
                  key={t.value}
                  on={draft.designations.includes(t.value)}
                  label={t.label}
                  onToggle={() => set({ designations: toggle(draft.designations, t.value) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Employees" all={firmoAll}>
            <div className="flex flex-wrap gap-2">
              {EMPLOYEE_BANDS.map((b) => (
                <Chip
                  key={b}
                  on={draft.employeeBands.includes(b)}
                  label={b}
                  onToggle={() => set({ employeeBands: toggle(draft.employeeBands, b) })}
                />
              ))}
            </div>
            <Text size="mono-xs" mono color="subtle">
              Known sizes only — most entities have no size on file
            </Text>
          </Section>

          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Counting…" : "Run"}
          </button>
        </Stack>
      </form>
    </Panel>
  );
}
