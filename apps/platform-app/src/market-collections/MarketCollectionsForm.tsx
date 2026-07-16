/**
 * MarketCollectionsForm — the Market tab's left rail, collections edition.
 *
 * Section order: Market (which collections — the opinionated POV, multi-select
 * = combined scope) → Geography (based in = HQ state; working in = the state
 * where the firm's CURRENT ACTIVE in-scope awards are performed) → Federal $
 * (the FY23–25 won band within the selected collections' pairs — the same
 * band the viewer's Bucket Explorer uses; max exclusive). Designations and
 * firmographics deliberately absent (operator ruling 2026-07-16).
 */
import { useId } from "react";

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { Panel } from "@/app/cockpit";
import { inputCls, labelCls, parseMoney, parseStates, primaryBtnCls } from "@/market/ui";

import type { Collection, CollectionsCountRequest } from "./api";

export type CollectionsDraft = {
  collections: string[];
  basedIn: string;
  workingIn: string;
  minWon: string;
  maxWon: string;
};

export const EMPTY_COLLECTIONS_DRAFT: CollectionsDraft = {
  collections: [],
  basedIn: "",
  workingIn: "",
  minWon: "",
  maxWon: "",
};

/** Compile the raw draft into the count request (omitted = All). */
export function buildCollectionsRequest(d: CollectionsDraft): CollectionsCountRequest {
  const req: CollectionsCountRequest = { collections: d.collections };
  const basedIn = parseStates(d.basedIn);
  if (basedIn) req.based_in = basedIn;
  const workingIn = parseStates(d.workingIn);
  if (workingIn) req.working_in = workingIn;
  const min = parseMoney(d.minWon);
  if (min != null) req.min_won = min;
  const max = parseMoney(d.maxWon);
  if (max != null) req.max_won = max;
  return req;
}

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
  all?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="3">
      <Inline justify="between" align="center">
        <span className={labelCls}>{title}</span>
        {all !== undefined ? <AllBadge on={all} /> : null}
      </Inline>
      {children}
    </Stack>
  );
}

function Chip({
  on,
  label,
  title,
  onToggle,
}: {
  on: boolean;
  label: string;
  title?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={title}
      className={cx(
        "border px-2 py-1 text-left font-mono text-mono-xs uppercase tracking-[0.1em] transition-colors",
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

export function MarketCollectionsForm({
  collections,
  draft,
  onDraft,
  onRun,
  busy,
}: {
  collections: Collection[] | null;
  draft: CollectionsDraft;
  onDraft: (d: CollectionsDraft) => void;
  onRun: () => void;
  busy: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<CollectionsDraft>) => onDraft({ ...draft, ...patch });

  const geoAll =
    parseStates(draft.basedIn) === undefined && parseStates(draft.workingIn) === undefined;
  const bandAll = parseMoney(draft.minWon) == null && parseMoney(draft.maxWon) == null;

  return (
    <Panel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        <Stack gap="6">
          <Section title="Market">
            {collections === null ? (
              <Text size="mono-xs" mono color="subtle">
                Loading collections…
              </Text>
            ) : (
              <div className="flex flex-wrap gap-2">
                {collections.map((c) => (
                  <Chip
                    key={c.slug}
                    on={draft.collections.includes(c.slug)}
                    label={c.title}
                    title={c.description}
                    onToggle={() => set({ collections: toggle(draft.collections, c.slug) })}
                  />
                ))}
              </div>
            )}
            <Text size="mono-xs" mono color="subtle">
              Multiple = combined scope · definitions are disjoint, never double-counted
            </Text>
          </Section>

          <Section title="Geography" all={geoAll}>
            <label htmlFor={`${id}-based`} className="sr-only">
              Based in states
            </label>
            <input
              id={`${id}-based`}
              value={draft.basedIn}
              onChange={(e) => set({ basedIn: e.target.value })}
              placeholder="based in (HQ) · TX OK LA (blank = All)"
              className={inputCls}
            />
            <label htmlFor={`${id}-working`} className="sr-only">
              Working in states
            </label>
            <input
              id={`${id}-working`}
              value={draft.workingIn}
              onChange={(e) => set({ workingIn: e.target.value })}
              placeholder="working in (active-award PoP) · TX (blank = All)"
              className={inputCls}
            />
            <Text size="mono-xs" mono color="subtle">
              Working in = where their current active in-scope awards are performed
            </Text>
          </Section>

          <Section title="Federal $ won · FY23–25 · in scope" all={bandAll}>
            <Inline gap="2">
              <label htmlFor={`${id}-min`} className="sr-only">
                Minimum won $
              </label>
              <input
                id={`${id}-min`}
                value={draft.minWon}
                onChange={(e) => set({ minWon: e.target.value })}
                placeholder="at least · 1m"
                className={inputCls}
              />
              <label htmlFor={`${id}-max`} className="sr-only">
                Maximum won $
              </label>
              <input
                id={`${id}-max`}
                value={draft.maxWon}
                onChange={(e) => set({ maxWon: e.target.value })}
                placeholder="under · 100m (exclusive)"
                className={inputCls}
              />
            </Inline>
            <Text size="mono-xs" mono color="subtle">
              Won within the selected collections’ code pairs — the same band as the viewer.
              Members also hold ≥1 active in-scope award.
            </Text>
          </Section>

          <button
            type="submit"
            disabled={busy || draft.collections.length === 0}
            className={primaryBtnCls}
          >
            {busy ? "Counting…" : draft.collections.length === 0 ? "Pick a market" : "Run"}
          </button>
        </Stack>
      </form>
    </Panel>
  );
}
