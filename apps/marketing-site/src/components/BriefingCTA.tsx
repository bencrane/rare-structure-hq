import { motion } from "framer-motion";
import { MASKED_FIELDS } from "@/data/briefing-data";

export function BriefingCTA() {
  return (
    <section className="flex min-h-screen items-center justify-center px-6 py-32">
      <motion.div
        className="w-full max-w-[520px] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-8 sm:p-12"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
          Sample Transaction Brief
        </div>

        <div className="space-y-3">
          {MASKED_FIELDS.map((field) => (
            <div
              key={field.label}
              className="flex items-baseline justify-between gap-4 border-b border-[color:var(--color-border-subtle)] pb-3"
            >
              <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[color:var(--color-text-subtle)]">
                {field.label}
              </span>
              <span
                className="text-right text-[0.875rem] text-[color:var(--color-text-primary)] select-none"
                style={{ filter: "blur(5px)" }}
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-[color:var(--color-border-default)] pt-8">
          <h3 className="font-display text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--color-text-primary)]">
            This is what we surface.
          </h3>
          <p className="mt-3 text-[0.875rem] leading-[1.6] text-[color:var(--color-text-muted)]">
            Proprietary data infrastructure capturing structural catalysts
            at the source — originated and routed before the broker market.
          </p>

          <button
            type="button"
            className="mt-6 w-full bg-[color:var(--color-accent-primary)] px-6 py-3 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--color-text-onAccent)] transition-colors hover:bg-[color:var(--color-accent-primaryHover)]"
          >
            Inquire
          </button>
        </div>
      </motion.div>
    </section>
  );
}
