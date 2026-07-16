/**
 * MarketCollectionsForm — the Market tab's left rail, collections edition.
 *
 * Prospect-facing register: three collapsible sections (accordion), each with
 * a header that reads back the current answer — the form is legible from its
 * closed state alone. Collections are grouped by family; selection is
 * checkbox-row based (22 items need scannable rows, not a chip cloud).
 *
 * Definitions unchanged: member = FY23–25 won within the selected collections'
 * pairs in [min, max) AND ≥1 active in-scope award (PoP-filtered by
 * "working in"). Designations/firmographics deliberately absent.
 */
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { Panel } from "@/app/cockpit";
import { inputCls, parseMoney, parseStates, primaryBtnCls } from "@/market/ui";

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

// ── Collection grouping (display only — slugs are the contract) ──────────────

const GROUPS: { title: string; slugs: string[] }[] = [
  {
    title: "Facilities & site services",
    slugs: [
      "facilities-support-operations-v2",
      "building-services-v2",
      "security-protective-services-v2",
    ],
  },
  {
    title: "Construction & environment",
    slugs: [
      "equipment-heavy-construction",
      "environmental-remediation-services",
      "waste-management-sanitation",
      "wildland-fire-forestry-services",
    ],
  },
  {
    title: "Manufacturing & supply",
    slugs: [
      "aerospace-defense-space-manufacturing",
      "industrial-machinery-components-manufacturing",
      "medical-devices-supplies-manufacturing",
      "food-production",
      "clothing-textiles",
    ],
  },
  {
    title: "Staffing & professional services",
    slugs: [
      "medical-clinical-staffing",
      "federal-it-staffing",
      "engineering-technical-staffing",
      "program-management-support-staffing",
      "administrative-office-support-staffing",
    ],
  },
  {
    title: "Transportation & logistics",
    slugs: [
      "sealift-marine-services",
      "air-charter-cargo",
      "aviation-maintenance-support",
      "warehousing-distribution",
      "ground-transportation-freight",
    ],
  },
];

function groupCollections(collections: Collection[]): { title: string; items: Collection[] }[] {
  const bySlug = new Map(collections.map((c) => [c.slug, c]));
  const placed = new Set<string>();
  const groups = GROUPS.map((g) => {
    const items = g.slugs
      .map((s) => bySlug.get(s))
      .filter((c): c is Collection => c !== undefined);
    for (const c of items) placed.add(c.slug);
    return { title: g.title, items };
  }).filter((g) => g.items.length > 0);
  const rest = collections.filter((c) => !placed.has(c.slug));
  if (rest.length > 0) groups.push({ title: "More markets", items: rest });
  return groups;
}

// ── Presets ──────────────────────────────────────────────────────────────────

const BAND_PRESETS: { label: string; min: string; max: string }[] = [
  { label: "$1M – $10M", min: "1m", max: "10m" },
  { label: "$10M – $100M", min: "10m", max: "100m" },
  { label: "$1M – $100M", min: "1m", max: "100m" },
];

// ── Drawer ───────────────────────────────────────────────────────────────────

function Drawer({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[color:var(--color-border-subtle)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-surface-raised)]"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
            {title}
          </Text>
          <Text size="body-sm" color="default" className="truncate">
            {summary}
          </Text>
        </span>
        <ChevronDown
          size={16}
          className={cx(
            "shrink-0 text-[color:var(--color-text-subtle)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="border-[color:var(--color-border-subtle)] border-t px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CollectionRow({
  collection,
  on,
  onToggle,
}: {
  collection: Collection;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cx(
        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
        on
          ? "bg-[color:var(--color-accent-soft)]"
          : "hover:bg-[color:var(--color-surface-raised)]",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
          on
            ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
            : "border-[color:var(--color-border-default)] text-transparent",
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-col">
        <Text size="body-sm" color={on ? "primary" : "default"}>
          {collection.title}
        </Text>
        <Text size="body-xs" color="subtle" className="line-clamp-1">
          {collection.description}
        </Text>
      </span>
    </button>
  );
}

// ── The rail ─────────────────────────────────────────────────────────────────

type SectionKey = "market" | "geography" | "band";

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
  const [open, setOpen] = useState<Set<SectionKey>>(() => new Set(["market"]));
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (t: string) =>
    setOpenGroups((cur) => {
      const next = new Set(cur);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const set = (patch: Partial<CollectionsDraft>) => onDraft({ ...draft, ...patch });
  const toggleSection = (k: SectionKey) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const selected = draft.collections;
  const titleOf = (slug: string) =>
    collections?.find((c) => c.slug === slug)?.title ?? slug;

  const marketSummary =
    selected.length === 0
      ? "Choose one or more markets"
      : selected.length === 1
        ? titleOf(selected[0])
        : `${titleOf(selected[0])} + ${selected.length - 1} more`;

  const basedIn = parseStates(draft.basedIn);
  const workingIn = parseStates(draft.workingIn);
  const geoSummary =
    !basedIn && !workingIn
      ? "Anywhere"
      : [
          basedIn ? `Based in ${basedIn.join(", ")}` : null,
          workingIn ? `Working in ${workingIn.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const min = parseMoney(draft.minWon);
  const max = parseMoney(draft.maxWon);
  const fmtShort = (v: number) =>
    v >= 1e9 ? `$${v / 1e9}B` : v >= 1e6 ? `$${v / 1e6}M` : `$${Math.round(v / 1e3)}K`;
  const bandSummary =
    min == null && max == null
      ? "Any size"
      : `${min != null ? fmtShort(min) : "$0"} – ${max != null ? `under ${fmtShort(max)}` : "no cap"}`;

  return (
    <Panel padded={false}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        <div className="p-4">
          <Stack gap="3">
          <Drawer
            title="Market"
            summary={marketSummary}
            open={open.has("market")}
            onToggle={() => toggleSection("market")}
          >
            {collections === null ? (
              <Text size="body-sm" color="subtle">
                Loading markets…
              </Text>
            ) : (
              <Stack gap="2">
                {groupCollections(collections).map((g) => {
                  const groupOpen = openGroups.has(g.title);
                  const selectedInGroup = g.items.filter((c) => selected.includes(c.slug)).length;
                  return (
                    <div
                      key={g.title}
                      className="border border-[color:var(--color-border-subtle)]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.title)}
                        aria-expanded={groupOpen}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-surface-raised)]"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <Text size="body-sm" color={selectedInGroup > 0 ? "primary" : "default"}>
                            {g.title}
                          </Text>
                          <Text size="body-xs" color="subtle">
                            {selectedInGroup > 0
                              ? `${selectedInGroup} of ${g.items.length} selected`
                              : `${g.items.length} markets`}
                          </Text>
                        </span>
                        <ChevronDown
                          size={14}
                          className={cx(
                            "shrink-0 text-[color:var(--color-text-subtle)] transition-transform",
                            groupOpen && "rotate-180",
                          )}
                        />
                      </button>
                      {groupOpen ? (
                        <div className="flex flex-col border-[color:var(--color-border-subtle)] border-t py-1">
                          {g.items.map((c) => (
                            <CollectionRow
                              key={c.slug}
                              collection={c}
                              on={selected.includes(c.slug)}
                              onToggle={() =>
                                set({
                                  collections: selected.includes(c.slug)
                                    ? selected.filter((s) => s !== c.slug)
                                    : [...selected, c.slug],
                                })
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <Text size="body-xs" color="subtle" className="pt-1">
                  Selecting several combines them into one market — definitions never overlap,
                  so nothing is counted twice.
                </Text>
              </Stack>
            )}
          </Drawer>

          <Drawer
            title="Geography"
            summary={geoSummary}
            open={open.has("geography")}
            onToggle={() => toggleSection("geography")}
          >
            <Stack gap="4">
              <Stack gap="2">
                <label htmlFor={`${id}-based`}>
                  <Text size="body-sm" color="default">
                    Based in
                  </Text>
                </label>
                <input
                  id={`${id}-based`}
                  value={draft.basedIn}
                  onChange={(e) => set({ basedIn: e.target.value })}
                  placeholder="TX OK LA — blank for anywhere"
                  className={inputCls}
                />
                <Text size="body-xs" color="subtle">
                  Where the company is headquartered.
                </Text>
              </Stack>
              <Stack gap="2">
                <label htmlFor={`${id}-working`}>
                  <Text size="body-sm" color="default">
                    Working in
                  </Text>
                </label>
                <input
                  id={`${id}-working`}
                  value={draft.workingIn}
                  onChange={(e) => set({ workingIn: e.target.value })}
                  placeholder="TX — blank for anywhere"
                  className={inputCls}
                />
                <Text size="body-xs" color="subtle">
                  Where their current active contracts in this market are performed.
                </Text>
              </Stack>
            </Stack>
          </Drawer>

          <Drawer
            title="Contract dollars won · FY23–25"
            summary={bandSummary}
            open={open.has("band")}
            onToggle={() => toggleSection("band")}
          >
            <Stack gap="3">
              <Inline gap="2">
                {BAND_PRESETS.map((p) => {
                  const active = draft.minWon === p.min && draft.maxWon === p.max;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => set({ minWon: p.min, maxWon: p.max })}
                      className={cx(
                        "border px-2.5 py-1 text-body-xs transition-colors",
                        active
                          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                          : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border-default)] hover:text-[color:var(--color-text-default)]",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </Inline>
              <Inline gap="2">
                <label htmlFor={`${id}-min`} className="sr-only">
                  Minimum won dollars
                </label>
                <input
                  id={`${id}-min`}
                  value={draft.minWon}
                  onChange={(e) => set({ minWon: e.target.value })}
                  placeholder="at least · 1m"
                  className={inputCls}
                />
                <label htmlFor={`${id}-max`} className="sr-only">
                  Maximum won dollars
                </label>
                <input
                  id={`${id}-max`}
                  value={draft.maxWon}
                  onChange={(e) => set({ maxWon: e.target.value })}
                  placeholder="under · 100m"
                  className={inputCls}
                />
              </Inline>
              <Text size="body-xs" color="subtle">
                Federal dollars won in this market, FY2023–FY2025. Every firm counted also
                holds at least one active contract in the market today.
              </Text>
            </Stack>
          </Drawer>

          <div className="sticky bottom-0 -mx-4 -mb-4 border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-base)] px-4 py-3">
            <button
              type="submit"
              disabled={busy || selected.length === 0}
              className={cx(primaryBtnCls, "w-full")}
            >
              {busy ? "Counting…" : selected.length === 0 ? "Choose a market to run" : "Run"}
            </button>
          </div>
          </Stack>
        </div>
      </form>
    </Panel>
  );
}
