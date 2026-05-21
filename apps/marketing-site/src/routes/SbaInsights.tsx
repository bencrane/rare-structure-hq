import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  PIPELINE, DISBURSEMENT, TOP_INDUSTRIES, TOP_FRANCHISES,
  TOP_LENDERS, CANCELLATION_RATES, TOP_STATES,
  fmtB, fmtM, fmtK, fmtCount,
} from "@/data/sba-insights-data";

const ey = "font-mono text-[0.5625rem] font-semibold uppercase tracking-[0.18em]";
const enter = {
  initial: { opacity: 0, y: 16 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, amount: 0.2 } as const,
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

const wait30Plus = DISBURSEMENT.buckets.filter((b) => b.minDays >= 30).reduce((s, b) => s + b.pct, 0);
const maxIndustryCount = Math.max(...TOP_INDUSTRIES.map((i) => i.count));
const maxLenderCount = Math.max(...TOP_LENDERS.map((l) => l.count));
const maxBucketPct = Math.max(...DISBURSEMENT.buckets.map((b) => b.pct));
const maxCancRate = Math.max(...CANCELLATION_RATES.map((c) => c.rate), 20);

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-[color:var(--color-surface-base)] px-6 py-7">
      <p className={`${ey} text-[color:var(--color-text-subtle)]`}>{label}</p>
      <p className="mt-2 font-mono text-[1.75rem] font-semibold tabular-nums text-[color:var(--color-text-primary)] md:text-[2rem]">
        {value}
      </p>
      <p className="mt-1 text-[0.6875rem] text-[color:var(--color-text-subtle)]">{sub}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, body, thesis }: { eyebrow: string; title: string; body: string; thesis?: string }) {
  return (
    <motion.div {...enter}>
      <p className={`${ey} text-[color:var(--color-text-accent)]`}>{eyebrow}</p>
      <h2 className="mt-2 font-display text-[1.5rem] font-semibold leading-[1.15] text-[color:var(--color-text-primary)] sm:text-[1.75rem]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-[0.875rem] leading-[1.65] text-[color:var(--color-text-muted)]">
        {body}
      </p>
      {thesis && (
        <div className="mt-4 border-l-2 border-[color:var(--color-text-accent)] bg-[color:var(--color-accent-soft)] py-3 pl-4">
          <p className="text-[0.8125rem] leading-[1.55] text-[color:var(--color-text-default)]">
            {thesis}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default function SbaInsights() {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-4xl">
          <motion.div {...enter}>
            <p className={`${ey} text-[color:var(--color-text-accent)]`}>SBA 7(a) Pipeline Monitor</p>
            <h1 className="mt-4 font-display text-[2.25rem] font-semibold leading-[1.08] text-[color:var(--color-text-primary)] sm:text-[3rem]">
              23,724 borrowers approved.
              <br />
              <span className="text-[color:var(--color-text-muted)]">$8.8 billion undisbursed.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[0.9375rem] leading-[1.65] text-[color:var(--color-text-muted)]">
              Every SBA 7(a) commitment since 2019 — sourced from SBA FOIA data, not
              press releases. The disbursement gap is where origination leverage concentrates:
              borrowers approved but not yet funded are the highest-conviction refinance
              and bridge-lending opportunities in the mid-market.
            </p>
            <div className="mt-8 inline-flex items-center gap-3 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-4 py-2.5">
              <span className={`${ey} text-[color:var(--color-text-subtle)]`}>{PIPELINE.quarterLabel} pipeline</span>
              <span className="font-mono text-[1rem] font-semibold text-[color:var(--color-text-primary)]">
                {fmtCount(PIPELINE.quarterCount)} borrowers
              </span>
              <span className="font-mono text-[0.8125rem] text-[color:var(--color-text-muted)]">
                {fmtB(PIPELINE.quarterDollars)}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)]">
        <div className="grid grid-cols-2 gap-px bg-[color:var(--color-border-subtle)] md:grid-cols-4">
          <StatCell label="Total pending" value={fmtCount(PIPELINE.totalPendingCount)} sub="Full-decade COMMIT" />
          <StatCell label="Pending capital" value={fmtB(PIPELINE.totalPendingDollars)} sub="SBA approved, undisbursed" />
          <StatCell label="Median wait" value={`${DISBURSEMENT.p50Days} days`} sub="Approval → disbursement" />
          <StatCell label="Wait 30+ days" value={`${wait30Plus.toFixed(0)}%`} sub="Of recent cohorts" />
        </div>
      </section>

      {/* ── Disbursement timing ────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="Disbursement timing"
            title="The gap between approval and capital."
            body={`Based on 214,000+ funded 7(a) loans (2022+). Median: ${DISBURSEMENT.p50Days} days. P75: ${DISBURSEMENT.p75Days} days. P90: ${DISBURSEMENT.p90Days} days.`}
            thesis="Every day in the disbursement gap is a day the borrower needs working capital from somewhere else. This is the origination window."
          />

          <motion.div className="mt-8 space-y-2.5" {...enter}>
            {DISBURSEMENT.buckets.map((b) => {
              const w = (b.pct / maxBucketPct) * 100;
              const isLong = b.minDays >= 60;
              return (
                <div key={b.label} className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{b.label}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-5 bg-[color:var(--color-surface-raised)]">
                      <div
                        className={isLong ? "h-full bg-red-900/50" : "h-full bg-[color:var(--color-accent-primary)]"}
                        style={{ width: `${w}%`, opacity: isLong ? 1 : 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right">
                    <span className="font-mono text-[0.8125rem] tabular-nums text-[color:var(--color-text-primary)]">{b.pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Top industries ─────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="By industry"
            title="Where the undisbursed capital concentrates."
            body="NAICS-level breakdown of pending COMMIT loans. Restaurants and fitness dominate — franchise-heavy industries with predictable deployment cycles."
            thesis="Industry concentration reveals which sectors generate the most repeatable origination flow. Construction and healthcare are the sleeper categories — lower franchise density, higher ticket sizes."
          />

          <motion.div className="mt-8 space-y-2.5" {...enter}>
            {TOP_INDUSTRIES.map((ind, i) => (
              <div key={ind.naics} className="flex items-center gap-4">
                <div className="w-5 shrink-0 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.75rem] text-[color:var(--color-text-default)]">{ind.name}</span>
                    <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-[color:var(--color-text-muted)]">
                      {fmtCount(ind.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-3.5 bg-[color:var(--color-surface-raised)]">
                    <div
                      className="h-full bg-[color:var(--color-accent-primary)]"
                      style={{ width: `${(ind.count / maxIndustryCount) * 100}%`, opacity: 0.45 }}
                    />
                  </div>
                </div>
                <div className="hidden w-16 text-right md:block">
                  <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{fmtM(ind.dollars)}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Top franchises ─────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="By franchise"
            title="The brands with the deepest SBA pipelines."
            body="Franchise borrowers carry structural advantages — the franchisor's brand provides soft collateral, unit economics are proven, and ticket sizes are predictable."
            thesis="For a capital partner, franchise-heavy lender books are lower-risk origination targets. The franchisor's brand de-risks the borrower profile before diligence even begins."
          />

          <motion.div className="mt-8 overflow-x-auto" {...enter}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[color:var(--color-border-default)]">
                  <th className={`${ey} py-2 pr-4 text-[color:var(--color-text-subtle)]`}>#</th>
                  <th className={`${ey} py-2 pr-4 text-[color:var(--color-text-subtle)]`}>Franchise</th>
                  <th className={`${ey} py-2 pr-4 text-right text-[color:var(--color-text-subtle)]`}>Pending</th>
                  <th className={`${ey} py-2 pr-4 text-right text-[color:var(--color-text-subtle)]`}>Avg ticket</th>
                  <th className={`${ey} py-2 text-right text-[color:var(--color-text-subtle)]`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {TOP_FRANCHISES.map((f, i) => (
                  <tr key={f.name} className="border-b border-[color:var(--color-border-subtle)]">
                    <td className="py-3 pr-4 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{i + 1}</td>
                    <td className="py-3 pr-4 text-[0.8125rem] text-[color:var(--color-text-default)]">{f.name}</td>
                    <td className="py-3 pr-4 text-right font-mono text-[0.75rem] tabular-nums text-[color:var(--color-text-primary)]">
                      {fmtCount(f.count)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-[0.75rem] tabular-nums text-[color:var(--color-text-muted)]">
                      {fmtK(f.avg)}
                    </td>
                    <td className="py-3 text-right font-mono text-[0.75rem] tabular-nums text-[color:var(--color-text-subtle)]">
                      {fmtM(f.dollars)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── Top lenders ────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="By lender"
            title="Who's originating the most SBA flow."
            body="Lenders ranked by pending COMMIT volume. High pending count signals active origination — and a larger cohort of borrowers in the disbursement gap."
            thesis="Lender pipeline concentration is a direct signal for where refinance and bridge-lending opportunities cluster. The top 10 lenders hold disproportionate share of the pending book."
          />

          <motion.div className="mt-8 space-y-2.5" {...enter}>
            {TOP_LENDERS.map((l, i) => (
              <div key={l.name} className="flex items-center gap-4">
                <div className="w-5 shrink-0 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.75rem] text-[color:var(--color-text-default)]">{l.name}</span>
                    <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-[color:var(--color-text-muted)]">
                      {fmtCount(l.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-3.5 bg-[color:var(--color-surface-raised)]">
                    <div
                      className="h-full bg-[color:var(--color-text-muted)]"
                      style={{ width: `${(l.count / maxLenderCount) * 100}%`, opacity: 0.3 }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="font-mono text-[0.5rem] text-[color:var(--color-text-subtle)]">{fmtM(l.dollars)}</span>
                    <span className="font-mono text-[0.5rem] text-[color:var(--color-text-subtle)]">{l.franchisePct}% franchise</span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Cancellation rates ─────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="Cancellation risk"
            title="Cohort cancellation rates, 2019–2025."
            body="Cancellation rate: the share of SBA 7(a) approvals in a cohort year that were ultimately cancelled. Baseline was 10–12% through 2019–2023."
            thesis="The 2025 spike to 16% is elevated but underwritable — 84% of the cohort completes as expected. Cancellations cluster in early-stage borrowers who found alternative funding. For an originator, the cancellation cohort is itself a signal: these borrowers are actively seeking capital."
          />

          <motion.div className="mt-10" {...enter}>
            <div className="flex items-end gap-2 md:gap-3">
              {CANCELLATION_RATES.map((c) => {
                const h = (c.rate / maxCancRate) * 100;
                const isSpike = c.year === 2025;
                return (
                  <div key={c.year} className="flex flex-1 flex-col items-center gap-1">
                    <span className={`font-mono text-[0.5625rem] tabular-nums ${isSpike ? "text-red-400" : "text-[color:var(--color-text-subtle)]"}`}>
                      {c.rate.toFixed(1)}%
                    </span>
                    <div className="w-full" style={{ height: "80px" }}>
                      <div
                        className={isSpike ? "w-full bg-red-900/60" : "w-full bg-[color:var(--color-text-muted)]"}
                        style={{ height: `${h}%`, marginTop: `${100 - h}%`, opacity: isSpike ? 1 : 0.3 }}
                      />
                    </div>
                    <span className={`font-mono text-[0.5rem] tabular-nums ${isSpike ? "text-red-400" : "text-[color:var(--color-text-subtle)]"}`}>
                      {c.year}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Top states ─────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border-subtle)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            eyebrow="By state"
            title="Geographic concentration of the undisbursed pipeline."
            body="Top 10 states by pending SBA approval count."
            thesis="CA, TX, and FL account for a third of the national pipeline. State-level concentration maps directly to origination territory — these are the markets where boots-on-the-ground lending produces the highest deal density."
          />

          <motion.div className="mt-8 grid grid-cols-2 gap-px border border-[color:var(--color-border-default)] md:grid-cols-5" {...enter}>
            {TOP_STATES.map((s) => (
              <div key={s.state} className="bg-[color:var(--color-surface-raised)] px-5 py-5">
                <p className="font-mono text-[1.5rem] font-semibold text-[color:var(--color-text-primary)]">{s.state}</p>
                <p className="font-mono text-[0.8125rem] tabular-nums text-[color:var(--color-text-muted)]">{fmtCount(s.count)}</p>
                <p className="mt-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)]">{fmtM(s.dollars)}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Closing ────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <motion.div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between" {...enter}>
            <div>
              <p className={`${ey} text-[color:var(--color-text-accent)]`}>The origination signal</p>
              <h2 className="mt-2 font-display text-[1.5rem] font-semibold text-[color:var(--color-text-primary)]">
                This pipeline is where we originate.
              </h2>
              <p className="mt-2 text-[0.875rem] text-[color:var(--color-text-muted)]">
                Every data point above feeds the same proprietary infrastructure
                that identifies structural catalysts in real time.
              </p>
            </div>
            <Link
              to="/briefing"
              className="inline-flex shrink-0 items-center border border-[color:var(--color-text-accent)] bg-[color:var(--color-accent-soft)] px-6 py-3 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--color-text-accent)] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
            >
              View sovereign capital briefing →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Attribution ────────────────────────────────────────── */}
      <div className="border-t border-[color:var(--color-border-subtle)] px-6 py-3">
        <p className="mx-auto max-w-4xl font-mono text-[0.5rem] text-[color:var(--color-text-subtle)]">
          Sourced from SBA FOIA data. Dataset covers approvaldate 2019-10-01 through 2026-05-20.
          Rare Structure makes no representations about completeness or accuracy beyond what the
          SBA FOIA release includes.
        </p>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border-subtle)] px-6 py-8 text-center">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
          ©2026 Rare Structure LLC All Rights Reserved
        </span>
      </footer>
    </div>
  );
}
