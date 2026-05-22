import type { NarrativeSectionData } from "@/data/briefing-data";
import { motion } from "framer-motion";

const ALIGN_CLASS = {
  left: "items-start justify-start pl-8 sm:pl-16 lg:pl-24",
  right: "items-start justify-end pr-8 sm:pr-16 lg:pr-24",
  center: "items-center justify-center",
} as const;

export function NarrativeSection({ section }: { section: NarrativeSectionData }) {
  return (
    <section className={`flex min-h-screen ${ALIGN_CLASS[section.align]} py-32`}>
      <motion.div
        className="max-w-[420px] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-overlay)] p-8 backdrop-blur-md sm:p-10"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
          {section.eyebrow}
        </div>

        <h2 className="font-display text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.01em] text-[color:var(--color-text-primary)] sm:text-[1.625rem]">
          {section.headline}
        </h2>

        <p className="mt-4 text-[0.9375rem] leading-[1.6] text-[color:var(--color-text-muted)]">
          {section.body}
        </p>

        {section.stat && (
          <div className="mt-6 border-t border-[color:var(--color-border-subtle)] pt-5">
            <div className="font-display text-[2rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text-primary)]">
              {section.stat.value}
            </div>
            <div className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
              {section.stat.label}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
