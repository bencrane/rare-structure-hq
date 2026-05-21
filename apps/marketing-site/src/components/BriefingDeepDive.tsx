import { motion } from "framer-motion";

const PROFILE = {
  label: "Redacted Entity",
  type: "Prime Contractor — Heavy Civil",
  state: "California",
  naics: "237310 — Highway, Street, and Bridge Construction",
  cage: "●●●●●",
  uei: "●●●●●●●●●●●●",
};

const GOV_CONTRACTS = [
  { agency: "Dept. of Transportation", value: "$4.2M", status: "Active", period: "2025–2028" },
  { agency: "Army Corps of Engineers", value: "$1.8M", status: "Active", period: "2026–2027" },
  { agency: "Dept. of the Interior", value: "$890K", status: "Completed", period: "2024–2025" },
];

const DEBT_STACK = [
  { type: "UCC-1 — Equipment", filed: "2024-08", secured: "Caterpillar Financial", status: "Active" },
  { type: "UCC-1 — Line of Credit", filed: "2025-03", secured: "Pacific Western Bank", status: "Active" },
  { type: "SBA 7(a) — Term", filed: "2023-11", secured: "SBA / Live Oak Bank", status: "Current" },
];

const enter = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

export function BriefingDeepDive() {
  return (
    <section className="border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <motion.div {...enter}>
          <div className="mb-4 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
            05 / Single Entity — Deep Dive
          </div>
          <h2 className="font-display text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--color-text-primary)] sm:text-[2rem]">
            One company. Two capital structures. One origination signal.
          </h2>
          <p className="mt-3 max-w-[560px] text-[0.9375rem] leading-[1.6] text-[color:var(--color-text-muted)]">
            This is a real entity in our pipeline — name and identifiers redacted.
            The profile below is representative of the structural pattern we
            surface at scale.
          </p>
        </motion.div>

        {/* Profile header */}
        <motion.div
          className="mt-12 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-6 sm:p-8"
          {...enter}
        >
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-display text-[1.125rem] font-semibold text-[color:var(--color-text-primary)]">
                {PROFILE.label}
              </div>
              <div className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                {PROFILE.type}
              </div>
            </div>
            <div className="text-right font-mono text-[0.6875rem] text-[color:var(--color-text-subtle)]">
              <div>UEI {PROFILE.uei}</div>
              <div>CAGE {PROFILE.cage}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-6 border-t border-[color:var(--color-border-subtle)] pt-4 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            <span>{PROFILE.state}</span>
            <span className="text-[color:var(--color-border-default)]">·</span>
            <span>{PROFILE.naics}</span>
          </div>
        </motion.div>

        {/* Two-column: contracts + debt */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Government contracts */}
          <motion.div
            className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-6 sm:p-8"
            {...enter}
          >
            <div className="mb-5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-accent)]">
              Federal Contract Revenue
            </div>
            <div className="space-y-0 divide-y divide-[color:var(--color-border-subtle)]">
              {GOV_CONTRACTS.map((c) => (
                <div key={c.agency} className="flex items-baseline justify-between py-3">
                  <div>
                    <div className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                      {c.agency}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
                      {c.period} · {c.status}
                    </div>
                  </div>
                  <div className="font-mono text-[0.875rem] tabular-nums text-[color:var(--color-text-primary)]">
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-[color:var(--color-border-default)] pt-4">
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                Total active
              </span>
              <span className="font-display text-[1.25rem] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                $6.9M
              </span>
            </div>
          </motion.div>

          {/* Debt stack */}
          <motion.div
            className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-6 sm:p-8"
            {...enter}
          >
            <div className="mb-5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-accent)]">
              Commercial Debt Structure
            </div>
            <div className="space-y-0 divide-y divide-[color:var(--color-border-subtle)]">
              {DEBT_STACK.map((d) => (
                <div key={d.type} className="flex items-baseline justify-between py-3">
                  <div>
                    <div className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                      {d.type}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
                      Filed {d.filed} · {d.status}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[0.6875rem] text-[color:var(--color-text-muted)]">
                    {d.secured}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[color:var(--color-border-default)] pt-4">
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                Signal: Active sovereign revenue + layered commercial debt = refinance catalyst
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
