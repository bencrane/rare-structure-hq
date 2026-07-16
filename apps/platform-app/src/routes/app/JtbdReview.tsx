/**
 * JtbdReview — canonicalization quality audit for the 350 canonical job phrases.
 *
 * Left: the canonical vocabulary (search + sort by combo weight or variant
 * spread). Right: for the selected phrase, every distinct GPT-5.4 "to: …"
 * rewrite it absorbed (matched on the shared (naics, psc) combo grain), with
 * per-variant combo counts. "All" mode stacks every phrase with its variants
 * for a straight read-through. Read-only; data via the public
 * /api/v1/federal/jtbd-phrase-map broker (one fetch, filtered client-side).
 */
import { useEffect, useMemo, useState } from "react";

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { CockpitPage, Panel } from "@/app/cockpit";
import { inputCls } from "@/market/ui";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

type Variant = { variant: string; combo_count: number };
type PhraseEntry = {
  phrase: string;
  combo_count: number;
  variant_count: number;
  variants: Variant[];
};
type PhraseMap = { canonical_model: string; source_model: string; phrases: PhraseEntry[] };

type SortKey = "combos" | "variants" | "alpha";

const fmt = (n: number): string => n.toLocaleString("en-US");

function VariantList({ variants }: { variants: Variant[] }) {
  return (
    <ul className="flex flex-col">
      {variants.map((v) => (
        <li
          key={v.variant}
          className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-1.5 last:border-b-0"
        >
          <Text size="body-sm" color="default">
            {v.variant}
          </Text>
          <Text size="mono-xs" mono color="subtle" className="shrink-0 tabular-nums">
            {fmt(v.combo_count)}
          </Text>
        </li>
      ))}
    </ul>
  );
}

export default function JtbdReview() {
  const [data, setData] = useState<PhraseMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("combos");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/federal/jtbd-phrase-map`);
        if (!res.ok) throw new Error(`jtbd-phrase-map failed: ${res.status}`);
        const json = (await res.json()) as PhraseMap;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? data.phrases.filter(
          (p) =>
            p.phrase.toLowerCase().includes(q) ||
            p.variants.some((v) => v.variant.toLowerCase().includes(q)),
        )
      : data.phrases;
    const sorted = [...list];
    if (sort === "combos") sorted.sort((a, b) => b.combo_count - a.combo_count);
    else if (sort === "variants") sorted.sort((a, b) => b.variant_count - a.variant_count);
    else sorted.sort((a, b) => a.phrase.localeCompare(b.phrase));
    return sorted;
  }, [data, search, sort]);

  const current = useMemo(
    () => (selected ? (filtered.find((p) => p.phrase === selected) ?? null) : null),
    [filtered, selected],
  );

  return (
    <CockpitPage
      title="Phrase review"
      description="Each canonical job phrase and every distinct GPT-5.4 rewrite it absorbed — audit the 350 for quality, clarity, and naturalness."
      width="wide"
    >
      {error ? (
        <Panel>
          <Text size="body-sm" color="default">
            {error}
          </Text>
        </Panel>
      ) : data === null ? (
        <Panel>
          <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
            Loading the phrase map…
          </div>
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6">
            <Panel>
              <Stack gap="3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search phrases or variants…"
                  className={inputCls}
                />
                <Inline gap="2" align="center">
                  {(
                    [
                      ["combos", "by $ weight"],
                      ["variants", "by spread"],
                      ["alpha", "a–z"],
                    ] as [SortKey, string][]
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSort(k)}
                      className={cx(
                        "border px-2 py-1 font-mono text-mono-xs uppercase tracking-[0.14em] transition-colors",
                        sort === k
                          ? "border-[color:var(--color-border-accent)] text-[color:var(--color-text-accent)]"
                          : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    aria-pressed={showAll}
                    className={cx(
                      "ml-auto border px-2 py-1 font-mono text-mono-xs uppercase tracking-[0.14em] transition-colors",
                      showAll
                        ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                        : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)]",
                    )}
                  >
                    All
                  </button>
                </Inline>
                <Text size="mono-xs" mono color="subtle">
                  {fmt(filtered.length)} phrases ·{" "}
                  {fmt(filtered.reduce((n, p) => n + p.variant_count, 0))} variants
                </Text>
                <ul className="flex max-h-[65vh] flex-col overflow-y-auto">
                  {filtered.map((p) => (
                    <li key={p.phrase}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p.phrase);
                          setShowAll(false);
                        }}
                        className={cx(
                          "flex w-full items-baseline justify-between gap-3 border-[color:var(--color-border-subtle)] border-b px-1 py-1.5 text-left transition-colors last:border-b-0",
                          selected === p.phrase && !showAll
                            ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                            : "hover:bg-[color:var(--color-surface-sunken)]",
                        )}
                      >
                        <Text size="body-sm" color="default">
                          {p.phrase}
                        </Text>
                        <Text size="mono-xs" mono color="subtle" className="shrink-0 tabular-nums">
                          {fmt(p.variant_count)}v · {fmt(p.combo_count)}c
                        </Text>
                      </button>
                    </li>
                  ))}
                </ul>
              </Stack>
            </Panel>
          </div>

          <div className="min-w-0">
            {showAll ? (
              <Stack gap="4">
                {filtered.map((p) => (
                  <Panel key={p.phrase}>
                    <Stack gap="2">
                      <Inline justify="between" align="center">
                        <Text size="body-md" color="primary">
                          {p.phrase}
                        </Text>
                        <Text size="mono-xs" mono color="subtle">
                          {fmt(p.variant_count)} variants · {fmt(p.combo_count)} combos
                        </Text>
                      </Inline>
                      <VariantList variants={p.variants} />
                    </Stack>
                  </Panel>
                ))}
              </Stack>
            ) : current ? (
              <Panel>
                <Stack gap="2">
                  <Inline justify="between" align="center">
                    <Text size="body-md" color="primary">
                      {current.phrase}
                    </Text>
                    <Text size="mono-xs" mono color="subtle">
                      {fmt(current.variant_count)} variants · {fmt(current.combo_count)} combos
                    </Text>
                  </Inline>
                  <VariantList variants={current.variants} />
                </Stack>
              </Panel>
            ) : (
              <Panel>
                <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                  Pick a phrase on the left — or hit All for the full read-through
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </CockpitPage>
  );
}
