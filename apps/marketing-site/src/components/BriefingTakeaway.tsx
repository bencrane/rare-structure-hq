import { motion } from "framer-motion";

export function BriefingTakeaway() {
  return (
    <section className="border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)] px-6 py-24 sm:px-10 sm:py-32">
      <motion.div
        className="mx-auto max-w-[640px] text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
          Macro Takeaway
        </div>

        <h2 className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.015em] text-[color:var(--color-text-primary)] sm:text-[2.25rem]">
          The signal isn't one company.
          <br />
          It's 847 of them.
        </h2>

        <p className="mt-6 text-[0.9375rem] leading-[1.7] text-[color:var(--color-text-muted)]">
          Every entity profiled above is one instance of a structural pattern that repeats across
          the entire cohort. Sovereign revenue mandates create working capital pressure. Active
          commercial debt reveals credit literacy and existing lender relationships. The
          intersection is where the highest-conviction refinance and facility origination
          opportunities concentrate — before they reach the broker market.
        </p>

        <div className="mx-auto mt-10 grid max-w-[420px] grid-cols-3 gap-px border border-[color:var(--color-border-default)]">
          {[
            { value: "847", label: "Entities" },
            { value: "$2.1B", label: "Contract Value" },
            { value: "68%", label: "UCC Overlap" },
          ].map((s) => (
            <div key={s.label} className="bg-[color:var(--color-surface-raised)] px-4 py-5">
              <div className="font-display text-[1.375rem] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                {s.value}
              </div>
              <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
          This pipeline is proprietary. The data is refreshed daily.
        </p>
      </motion.div>
    </section>
  );
}
