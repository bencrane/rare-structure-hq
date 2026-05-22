import { DataSourceCycle, HomeMap } from "@/components/HomeMap";
import { Wordmark } from "@/components/Wordmark";
import { Link } from "react-router-dom";

const BRIEFINGS = [
  {
    to: "/briefing",
    title: "Sovereign Capital × Commercial Leverage",
    description:
      "Where federal contract revenue intersects with active commercial debt — the highest-conviction origination signal in mid-market lending.",
    stat: "847 entities · 68% UCC overlap",
    date: "May 2026",
  },
  {
    to: "/briefings/sba-pipeline",
    title: "SBA 7(a) Pipeline Monitor",
    description:
      "23,724 undisbursed SBA approvals totaling $8.8B — sliced by industry, franchise, lender, and state. The disbursement gap is the origination window.",
    stat: "$8.8B pending · 16% 2025 cancellation spike",
    date: "May 2026",
  },
];

export default function Home() {
  return (
    <main className="bg-[color:var(--color-surface-base)]">
      {/* ── Hero — US map + wordmark ─────────────────────────────────── */}
      <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
        <HomeMap />

        <div className="relative z-10">
          <Wordmark />
        </div>

        {/* Cycling data source labels */}
        <div className="relative z-10 mt-8 text-center">
          <DataSourceCycle />
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-0 right-0 z-10 text-center font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-[color:var(--color-text-subtle)]">
          ↓
        </div>
      </section>

      {/* ── Positioning ──────────────────────────────────────────────── */}
      <section className="border-t border-[color:var(--color-border-subtle)] px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-8 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
            The Firm
          </div>
          <p className="text-[1.125rem] leading-[1.65] text-[color:var(--color-text-default)] sm:text-[1.25rem]">
            Rare Structure is a catalyst-driven origination firm. We operate proprietary data
            infrastructure that identifies the exact moments mid-market companies hit structural
            capital inflection points — federal contract awards, refinancing windows, growth-equity
            triggers — and originate senior-secured transaction flow for institutional private
            credit partners.
          </p>
          <p className="mt-6 text-[1rem] leading-[1.65] text-[color:var(--color-text-muted)]">
            Originated flow is routed directly to investment committees — sourced at the structural
            catalyst, not the broker market.
          </p>
        </div>
      </section>

      {/* ── Pipeline stats ───────────────────────────────────────────── */}
      <section className="border-t border-[color:var(--color-border-subtle)] px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-[800px] grid-cols-2 gap-px border border-[color:var(--color-border-default)] sm:grid-cols-4">
          {[
            { value: "8,400+", label: "Entities tracked" },
            { value: "50", label: "States covered" },
            { value: "$14.2B", label: "Contract value" },
            { value: "Daily", label: "Pipeline refresh" },
          ].map((s) => (
            <div key={s.label} className="bg-[color:var(--color-surface-raised)] px-5 py-6 sm:px-6">
              <div className="font-display text-[1.5rem] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                {s.value}
              </div>
              <div className="mt-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Data sources — the breadth signal ────────────────────────── */}
      <section className="border-t border-[color:var(--color-border-subtle)] px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-8 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
            Pipeline Sources
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              "USAspending",
              "SBA 7(a) / 504",
              "SBA PPP",
              "UCC Filings",
              "SAM.gov",
              "FMCSA",
              "SEC Form ADV",
              "SEC EDGAR",
              "GLEIF",
              "HMDA",
              "CA Secretary of State",
              "FL Sunbiz",
              "DOL Form 5500",
              "USPTO Trademarks",
              "CMS Open Payments",
              "EPA ECHO",
              "FDIC",
              "NCUA",
              "FEC",
              "IRS BMF / 990",
              "CSLB",
              "Caltrans",
              "TXDOT",
              "PDL Companies",
              "Overture Places",
            ].map((source) => (
              <span
                key={source}
                className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]"
              >
                {source}
              </span>
            ))}
          </div>
          <p className="mt-6 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            100+ federal, state, and commercial data sources · cross-referenced through 40+ identity
            bridges
          </p>
        </div>
      </section>

      {/* ── Briefings ────────────────────────────────────────────────── */}
      <section className="border-t border-[color:var(--color-border-subtle)] px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-10 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
            Market Intelligence
          </div>

          <div className="divide-y divide-[color:var(--color-border-subtle)] border-y border-[color:var(--color-border-subtle)]">
            {BRIEFINGS.map((b) => (
              <Link key={b.to} to={b.to} className="group block py-6 transition-colors sm:py-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-[1.125rem] font-semibold leading-[1.2] text-[color:var(--color-text-primary)] transition-colors group-hover:text-[color:var(--color-text-accent)] sm:text-[1.375rem]">
                    {b.title}
                  </h3>
                  <span className="shrink-0 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                    {b.date}
                  </span>
                </div>
                <p className="mt-2 max-w-[600px] text-[0.875rem] leading-[1.6] text-[color:var(--color-text-muted)]">
                  {b.description}
                </p>
                <div className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                  {b.stat}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border-subtle)] px-6 py-8 text-center sm:px-10">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
          ©2026 Rare Structure LLC All Rights Reserved
        </span>
      </footer>
    </main>
  );
}
