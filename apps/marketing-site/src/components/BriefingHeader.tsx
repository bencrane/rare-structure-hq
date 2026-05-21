import { motion, useReducedMotion } from "framer-motion";

export function BriefingHeader() {
  const reduced = !!useReducedMotion();
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-overlay)] px-6 py-3 backdrop-blur-md sm:px-10"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-primary)]">
        Rare Structure
      </div>
      <div className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
        Intelligence Briefing
      </div>
    </motion.header>
  );
}
