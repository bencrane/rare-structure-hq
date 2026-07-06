/**
 * FilterRail — the Market tab's left-hand audience filter panel.
 *
 * Pure controlled UI over a `FilterDraft` (raw strings/toggles); the parent owns
 * the draft and calls `buildFilters` on Apply to compile it into the frozen
 * `AudienceFilters` wire shape ($-shorthand money parsed, state lists split,
 * NAICS/PSC inputs routed to exact-code vs prefix by length).
 */
import { Plus, X } from "lucide-react";
import { useId } from "react";

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { Panel } from "@/app/cockpit";
import type { AudienceFilters, LaneFilter } from "./api";
import { inputCls, labelCls, parseMoney, parseStates, primaryBtnCls } from "./ui";

export const EMPLOYEE_SIZE_BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001+",
] as const;

export const ENRICHMENT_STATES = [
  "dialable",
  "emailable",
  "bridged_no_contacts",
  "unbridged",
] as const;

export type LaneDraft = { naics: string; psc: string; minAmt: string };

export type FilterDraft = {
  bands: string[];
  subMin: string;
  subMax: string;
  primeMin: string;
  primeMax: string;
  popStates: string;
  physicalStates: string;
  inDsbs: boolean;
  isFfata: boolean;
  fsrsAny: boolean;
  minDialable: string;
  subbedUnder: LaneDraft[];
  primedIn: LaneDraft[];
  enrichmentStates: string[];
};

export const EMPTY_DRAFT: FilterDraft = {
  bands: [],
  subMin: "",
  subMax: "",
  primeMin: "",
  primeMax: "",
  popStates: "",
  physicalStates: "",
  inDsbs: false,
  isFfata: false,
  fsrsAny: false,
  minDialable: "",
  subbedUnder: [],
  primedIn: [],
  enrichmentStates: [],
};

const EMPTY_LANE: LaneDraft = { naics: "", psc: "", minAmt: "" };

/** 6-digit NAICS = exact code, shorter = prefix; 4-char PSC = exact, shorter = prefix. */
function laneFilter(d: LaneDraft, amtKey: "amt24moMin" | "obl24moMin"): LaneFilter | null {
  const lane: LaneFilter = {};
  const naics = d.naics.trim();
  const psc = d.psc.trim().toUpperCase();
  if (naics) {
    if (/^\d{6}$/.test(naics)) lane.naics = naics;
    else lane.naicsPrefix = naics;
  }
  if (psc) {
    if (psc.length === 4) lane.psc = psc;
    else lane.pscPrefix = psc;
  }
  const amt = parseMoney(d.minAmt);
  if (amt != null) lane[amtKey] = amt;
  return Object.keys(lane).length > 0 ? lane : null;
}

/** Compile the raw draft into the frozen AudienceFilters wire shape. */
export function buildFilters(d: FilterDraft): AudienceFilters {
  const f: AudienceFilters = {};
  if (d.bands.length > 0) f.employeeSizeBands = d.bands;
  const subMin = parseMoney(d.subMin);
  const subMax = parseMoney(d.subMax);
  const primeMin = parseMoney(d.primeMin);
  const primeMax = parseMoney(d.primeMax);
  if (subMin != null) f.subAmt24moMin = subMin;
  if (subMax != null) f.subAmt24moMax = subMax;
  if (primeMin != null) f.primeObl24moMin = primeMin;
  if (primeMax != null) f.primeObl24moMax = primeMax;
  const pop = parseStates(d.popStates);
  const phys = parseStates(d.physicalStates);
  if (pop) f.popStates = pop;
  if (phys) f.physicalStates = phys;
  if (d.inDsbs) f.inDsbs = true;
  if (d.isFfata) f.isFfata = true;
  if (d.fsrsAny) f.fsrsAnyDesignation = true;
  const minDialable = Number.parseInt(d.minDialable, 10);
  if (Number.isFinite(minDialable) && minDialable > 0) f.minDialable = minDialable;
  const subbed = d.subbedUnder
    .map((l) => laneFilter(l, "amt24moMin"))
    .filter((l): l is LaneFilter => l !== null);
  const primed = d.primedIn
    .map((l) => laneFilter(l, "obl24moMin"))
    .filter((l): l is LaneFilter => l !== null);
  if (subbed.length > 0) f.subbedUnder = subbed;
  if (primed.length > 0) f.primedIn = primed;
  if (d.enrichmentStates.length > 0) f.enrichmentStates = d.enrichmentStates;
  return f;
}

// ── Controls ─────────────────────────────────────────────────────────────────

function Chip({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
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

function Toggle({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em]">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 cursor-pointer accent-[var(--color-accent-primary)]"
      />
      {label}
    </label>
  );
}

function MoneyPair({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const id = useId();
  return (
    <Stack gap="2">
      <Text as="span" size="mono-xs" mono color="subtle">
        {label}
      </Text>
      <Inline gap="2">
        <label htmlFor={`${id}-min`} className="sr-only">
          {label} min
        </label>
        <input
          id={`${id}-min`}
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="min · 250k"
          className={inputCls}
        />
        <label htmlFor={`${id}-max`} className="sr-only">
          {label} max
        </label>
        <input
          id={`${id}-max`}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="max · 25m"
          className={inputCls}
        />
      </Inline>
    </Stack>
  );
}

function LaneRows({
  label,
  lanes,
  onChange,
}: {
  label: string;
  lanes: LaneDraft[];
  onChange: (lanes: LaneDraft[]) => void;
}) {
  const id = useId();
  const setLane = (i: number, patch: Partial<LaneDraft>) =>
    onChange(lanes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Stack gap="2">
      <Inline justify="between" align="center">
        <Text as="span" size="mono-xs" mono color="subtle">
          {label}
        </Text>
        <button
          type="button"
          onClick={() => onChange([...lanes, { ...EMPTY_LANE }])}
          className="flex items-center gap-1 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          <Plus className="size-3" />
          Add
        </button>
      </Inline>
      {lanes.length === 0 ? (
        <Text size="mono-xs" mono color="subtle">
          —
        </Text>
      ) : (
        lanes.map((lane, i) => (
          // Draft rows have no stable identity beyond position; index keys are safe
          // here because rows are only appended/removed, never reordered.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional draft rows
          <Inline key={`${label}-${i}`} gap="2" align="center">
            <label htmlFor={`${id}-${i}-naics`} className="sr-only">
              {label} NAICS code or prefix
            </label>
            <input
              id={`${id}-${i}-naics`}
              value={lane.naics}
              onChange={(e) => setLane(i, { naics: e.target.value })}
              placeholder="NAICS·pfx"
              className={inputCls}
            />
            <label htmlFor={`${id}-${i}-psc`} className="sr-only">
              {label} PSC code or prefix
            </label>
            <input
              id={`${id}-${i}-psc`}
              value={lane.psc}
              onChange={(e) => setLane(i, { psc: e.target.value })}
              placeholder="PSC·pfx"
              className={inputCls}
            />
            <label htmlFor={`${id}-${i}-amt`} className="sr-only">
              {label} minimum 24-month dollars
            </label>
            <input
              id={`${id}-${i}-amt`}
              value={lane.minAmt}
              onChange={(e) => setLane(i, { minAmt: e.target.value })}
              placeholder="min$·1m"
              className={inputCls}
            />
            <button
              type="button"
              aria-label={`Remove ${label} row`}
              onClick={() => onChange(lanes.filter((_, j) => j !== i))}
              className="shrink-0 text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-state-error)]"
            >
              <X className="size-3.5" />
            </button>
          </Inline>
        ))
      )}
    </Stack>
  );
}

// ── The rail ─────────────────────────────────────────────────────────────────

export function FilterRail({
  draft,
  onDraft,
  onApply,
  busy,
}: {
  draft: FilterDraft;
  onDraft: (d: FilterDraft) => void;
  onApply: () => void;
  busy: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<FilterDraft>) => onDraft({ ...draft, ...patch });
  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <Panel>
      <Stack gap="5">
        <Stack gap="2">
          <Text as="span" size="mono-xs" mono color="subtle">
            Employee size
          </Text>
          <Inline gap="2" wrap>
            {EMPLOYEE_SIZE_BANDS.map((b) => (
              <Chip
                key={b}
                on={draft.bands.includes(b)}
                label={b}
                onToggle={() => set({ bands: toggleIn(draft.bands, b) })}
              />
            ))}
          </Inline>
        </Stack>

        <MoneyPair
          label="Sub $ 24mo"
          min={draft.subMin}
          max={draft.subMax}
          onMin={(v) => set({ subMin: v })}
          onMax={(v) => set({ subMax: v })}
        />
        <MoneyPair
          label="Prime $ 24mo"
          min={draft.primeMin}
          max={draft.primeMax}
          onMin={(v) => set({ primeMin: v })}
          onMax={(v) => set({ primeMax: v })}
        />

        <Stack gap="2">
          <label htmlFor={`${id}-pop`} className={labelCls}>
            Primary PoP states
          </label>
          <input
            id={`${id}-pop`}
            value={draft.popStates}
            onChange={(e) => set({ popStates: e.target.value })}
            placeholder="VA, MD, DC"
            className={inputCls}
          />
        </Stack>
        <Stack gap="2">
          <label htmlFor={`${id}-phys`} className={labelCls}>
            Physical states
          </label>
          <input
            id={`${id}-phys`}
            value={draft.physicalStates}
            onChange={(e) => set({ physicalStates: e.target.value })}
            placeholder="TX, FL"
            className={inputCls}
          />
        </Stack>

        <Stack gap="3">
          <Toggle on={draft.inDsbs} label="In DSBS" onChange={(v) => set({ inDsbs: v })} />
          <Toggle
            on={draft.isFfata}
            label="FFATA discloser"
            onChange={(v) => set({ isFfata: v })}
          />
          <Toggle
            on={draft.fsrsAny}
            label="FSRS designation"
            onChange={(v) => set({ fsrsAny: v })}
          />
        </Stack>

        <Stack gap="2">
          <label htmlFor={`${id}-dial`} className={labelCls}>
            Min dialable people
          </label>
          <input
            id={`${id}-dial`}
            type="number"
            min={0}
            value={draft.minDialable}
            onChange={(e) => set({ minDialable: e.target.value })}
            placeholder="1"
            className={inputCls}
          />
        </Stack>

        <LaneRows
          label="Subbed under"
          lanes={draft.subbedUnder}
          onChange={(lanes) => set({ subbedUnder: lanes })}
        />
        <LaneRows
          label="Primed in"
          lanes={draft.primedIn}
          onChange={(lanes) => set({ primedIn: lanes })}
        />

        <Stack gap="2">
          <Text as="span" size="mono-xs" mono color="subtle">
            Enrichment state
          </Text>
          <Inline gap="2" wrap>
            {ENRICHMENT_STATES.map((s) => (
              <Chip
                key={s}
                on={draft.enrichmentStates.includes(s)}
                label={s.replace(/_/g, " ")}
                onToggle={() => set({ enrichmentStates: toggleIn(draft.enrichmentStates, s) })}
              />
            ))}
          </Inline>
        </Stack>

        <button type="button" onClick={onApply} disabled={busy} className={primaryBtnCls}>
          {busy ? "Querying…" : "Apply filters"}
        </button>
      </Stack>
    </Panel>
  );
}
