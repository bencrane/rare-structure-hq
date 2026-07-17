/**
 * DealIntake — PROTOTYPE: the capital-provider intake, live-compiled into the
 * Market result card.
 *
 * Per-deal instrument: the answers a capital-provider prospect gives (pre-call
 * form, on-call, or scraped) compile deterministically into a market-collections
 * count request — industries → collection union, minimum deal size → FY23–25
 * won floor (definitional: they lend against the whole federal book), lending
 * jurisdictions → based_in. Capital products never shrink the universe; they
 * pick which stats lead ("Product lens"). The Market tab stays the free
 * exploration instrument; this page is the same card, prospect-shaped.
 *
 * Register: what a prospect sees on a call — the section-card geometry of the
 * Application profile board (roomy cards on raised surface), not the dense
 * operator rail.
 */
import { Check, Landmark } from "lucide-react";
import { useCallback, useState } from "react";

import { Text, cx } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { parseStates } from "@/market/ui";
import { PaymentMix, StatGrid, fmt, fmt$ } from "@/market-collections/ResultCard";
import { type CollectionsCount, countCollections } from "@/market-collections/api";
import {
  CAPITAL_PRODUCTS,
  type CapitalProduct,
  type DealIntakeDraft,
  EMPTY_DEAL_INTAKE,
  INDUSTRY_FAMILIES,
  MIN_DEAL_OPTIONS,
  SWEET_SPOT_OPTIONS,
  compileIntake,
} from "@/market-collections/dealIntake";

// ── Building blocks (Application-board idiom: roomy section cards) ────────────

function SectionCard({
  label,
  question,
  children,
}: {
  label: string;
  question?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-6 md:p-7">
      <div className="mb-5 flex flex-col gap-1.5">
        <span className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          {label}
        </span>
        {question ? (
          <Text size="body-md" color="primary">
            {question}
          </Text>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** A checkbox/radio option row — one full-width row per option, room to read. */
function OptionRow({
  label,
  on,
  onToggle,
  radio = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cx(
        "flex w-full items-center gap-3.5 border px-4 py-3.5 text-left transition-colors",
        on
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] hover:border-[color:var(--color-border-strong)]",
      )}
    >
      <span
        className={cx(
          "flex h-4 w-4 shrink-0 items-center justify-center border",
          radio && "rounded-full",
          on
            ? "border-[color:var(--color-border-accent)] text-[color:var(--color-text-accent)]"
            : "border-[color:var(--color-border-default)] text-transparent",
        )}
      >
        {radio ? (
          <span className={cx("h-2 w-2 rounded-full", on && "bg-[color:var(--color-text-accent)]")} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </span>
      <span
        className={cx(
          "text-body-md",
          on ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-default)]",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Product lens — which of the card's numbers each selected product should read first. */
function ProductLens({ products, result }: { products: CapitalProduct[]; result: CollectionsCount }) {
  if (products.length === 0 || result.book_total <= 0) return null;
  const book = result.book_total;
  const pct = (v: number): string => `${((v / book) * 100).toFixed(1)}%`;
  const receivables = result.pricing_cost_value + result.pricing_tm_lh_value;
  const lines: Record<CapitalProduct, { head: string; body: string }> = {
    ar_factoring: {
      head: `Invoiced-receivables paper: ${fmt$(receivables)} (${pct(receivables)})`,
      body: "Cost-reimbursement + T&M — work billed to the government as performed: the factorable flow.",
    },
    abl_revolver: {
      head: `Invoiced-receivables paper: ${fmt$(receivables)} (${pct(receivables)})`,
      body: "Cost-reimbursement + T&M committed value — the receivables base a revolver borrows against.",
    },
    equipment_finance: {
      head: `Fixed-price share: ${pct(result.pricing_fixed_value)} of ${fmt$(book)}`,
      body: "Firms carrying cost and float on fixed-price work — where owned equipment and its financing live.",
    },
    unsecured_wc: {
      head: `Committed runway: ${fmt$(result.runway_total)} (median ${fmt$(result.runway_median)}/firm)`,
      body: "Contracted value not yet billed — the forward revenue an unsecured advance fronts.",
    },
    po_mobilization: {
      head: `FFP with no government financing recorded: ${fmt$(result.ffp_unfinanced_value)} (${pct(result.ffp_unfinanced_value)})`,
      body: "Fixed-price work with no financing on record — the maximum mobilization working-capital need.",
    },
  };
  return (
    <div className="flex flex-col gap-2">
      <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
        Product lens
      </Text>
      <div className="flex flex-col gap-3">
        {products.map((p) => (
          <div key={p} className="border border-[color:var(--color-border-subtle)] px-5 py-4">
            <Text size="body-xs" color="subtle">
              {CAPITAL_PRODUCTS.find((c) => c.key === p)?.label}
            </Text>
            <div className="pt-1.5 font-mono text-sm text-[color:var(--color-text-primary)] tabular-nums">
              {lines[p].head}
            </div>
            <Text size="body-xs" color="subtle" className="pt-1.5">
              {lines[p].body}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DealIntake() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [draft, setDraft] = useState<DealIntakeDraft>(EMPTY_DEAL_INTAKE);
  const [result, setResult] = useState<CollectionsCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<DealIntakeDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const run = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await countCollections(token, compileIntake(draft, parseStates)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Count failed");
    } finally {
      setBusy(false);
    }
  }, [token, draft]);

  const familyLabels =
    draft.industries.length === 0
      ? "all industries"
      : INDUSTRY_FAMILIES.filter((f) => draft.industries.includes(f.key))
          .map((f) => f.label)
          .join(" + ");

  return (
    <CockpitPage
      title="Deal intake"
      description="A capital provider's intake answers, compiled live into their view of the market. Prototype — per-deal persistence comes later."
      width="wide"
    >
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        {/* ── The intake (left) ─────────────────────────────────────────────── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex flex-col gap-4"
        >
          <SectionCard label="Field 1" question="Primary capital product(s)">
            <div className="flex flex-col gap-2">
              {CAPITAL_PRODUCTS.map((p) => (
                <OptionRow
                  key={p.key}
                  label={p.label}
                  on={draft.products.includes(p.key)}
                  onToggle={() =>
                    set({ products: toggle(draft.products, p.key) as CapitalProduct[] })
                  }
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            label="Field 2"
            question="Which industries will you lend into? Leave blank for all."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INDUSTRY_FAMILIES.map((f) => (
                <OptionRow
                  key={f.key}
                  label={f.label}
                  on={draft.industries.includes(f.key)}
                  onToggle={() => set({ industries: toggle(draft.industries, f.key) })}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            label="Field 3 · The floor"
            question="What is your absolute minimum facility or ticket size per transaction?"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MIN_DEAL_OPTIONS.map((o) => (
                <OptionRow
                  key={o.label}
                  radio
                  label={o.label}
                  on={draft.minDealLabel === o.label}
                  onToggle={() =>
                    set({ minDealLabel: draft.minDealLabel === o.label ? "" : o.label })
                  }
                />
              ))}
            </div>
            <Text size="body-sm" color="muted" className="pt-3">
              Applied to the firm's FY23–25 federal winnings — you lend against the whole book, so
              that is the size that matters.
            </Text>
          </SectionCard>

          <SectionCard
            label="Field 4 · The target"
            question="What is your target/optimal facility or ticket size per transaction?"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SWEET_SPOT_OPTIONS.map((o) => (
                <OptionRow
                  key={o}
                  radio
                  label={o}
                  on={draft.sweetSpotLabel === o}
                  onToggle={() => set({ sweetSpotLabel: draft.sweetSpotLabel === o ? "" : o })}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            label="Field 5"
            question="Lending jurisdictions / geographic footprint"
          >
            <div className="flex flex-col gap-2">
              <OptionRow
                radio
                label="Nationwide (All 50 States)"
                on={draft.nationwide}
                onToggle={() => set({ nationwide: true })}
              />
              <OptionRow
                radio
                label="Regional restrictions (specify allowed states)"
                on={!draft.nationwide}
                onToggle={() => set({ nationwide: false })}
              />
              {!draft.nationwide ? (
                <input
                  value={draft.states}
                  onChange={(e) => set({ states: e.target.value })}
                  placeholder="TX OK LA"
                  className="mt-1 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-4 py-3.5 text-[color:var(--color-text-primary)] text-body-md outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            label="Field 6"
            question="Will you fund against government receivables?"
          >
            <div className="grid grid-cols-3 gap-2">
              {(["yes", "no", "unsure"] as const).map((v) => (
                <OptionRow
                  key={v}
                  radio
                  label={v === "yes" ? "Yes" : v === "no" ? "No" : "Unsure"}
                  on={draft.govReceivables === v}
                  onToggle={() => set({ govReceivables: draft.govReceivables === v ? "" : v })}
                />
              ))}
            </div>
          </SectionCard>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-6 py-3.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)] disabled:opacity-50"
          >
            {busy ? "Compiling…" : "Show their market"}
          </button>
        </form>

        {/* ── Their market (right, sticky) ──────────────────────────────────── */}
        <div className="min-w-0 xl:sticky xl:top-6">
          {error ? (
            <Panel>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Text size="body-sm" color="default">
                  Couldn't run the intake
                </Text>
                <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                  {error}
                </Text>
              </div>
            </Panel>
          ) : result === null ? (
            <Panel padded={false}>
              <EmptyState
                icon={Landmark}
                title="No intake compiled yet"
                description="Fill in what the capital provider told you (or would tell you) and hit Show their market — their view of the federal universe lands here."
              />
            </Panel>
          ) : (
            <Panel>
              <div className="flex flex-col gap-8 px-6 py-8">
                <div className="flex flex-col gap-1">
                  <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
                    Their market
                  </Text>
                  <Text size="body-lg" color="primary">
                    {`Federal contractors · ${familyLabels}`}
                  </Text>
                  <Text size="body-xs" color="subtle">
                    {[
                      draft.minDealLabel ? `floor ${draft.minDealLabel}` : "no size floor",
                      draft.sweetSpotLabel ? `sweet spot ${draft.sweetSpotLabel}` : null,
                      draft.nationwide ? "nationwide" : `based in ${draft.states.toUpperCase()}`,
                      draft.govReceivables === "no" || draft.govReceivables === "unsure"
                        ? "⚠ government-receivables funding unconfirmed"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </div>

                <StatGrid
                  title="The market"
                  stats={[
                    { label: "Firms", value: fmt(result.count) },
                    { label: "Total won · FY23–25", value: fmt$(result.won_total) },
                    { label: "Median won per firm", value: fmt$(result.won_median) },
                    { label: "Average won per firm", value: fmt$(result.won_avg) },
                  ]}
                />

                <ProductLens products={draft.products} result={result} />

                <PaymentMix
                  result={result}
                  collectionCount={(result.spec.collections as string[]).length}
                />

                <StatGrid
                  title="Committed work — active contracts today"
                  caption="Standalone awards + task orders at contract value. Runway = value not yet billed."
                  stats={[
                    { label: "Book · total", value: fmt$(result.book_total) },
                    { label: "Book per firm · med / avg", value: `${fmt$(result.book_median)} / ${fmt$(result.book_avg)}` },
                    { label: "Runway · total", value: fmt$(result.runway_total) },
                  ]}
                />

                <Text size="body-xs" color="subtle">
                  Every firm counted holds at least one active contract in scope today.
                  {result.elapsed_ms != null ? ` · ${Math.round(result.elapsed_ms)} ms` : ""}
                </Text>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </CockpitPage>
  );
}
