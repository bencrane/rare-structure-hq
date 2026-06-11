/**
 * CompanyProfile — the right-side drawer that opens when a company dot on the
 * map is clicked. It is the "click a dot, it opens up to the company" moment.
 *
 * The profile shows the company's identity and its Capital Catalysts — the
 * structural signals attached to it. Every plotted company carries the
 * federal-award catalyst (the query axis); a UCC-1 secured-debt catalyst and
 * a BDC loan-maturity catalyst appear when the company has them. New catalyst
 * kinds slot into the same card with no layout change.
 *
 * Styled on the `@rare-structure-hq` design system. Closes on X / backdrop
 * (Esc is handled globally by `DemoApp`).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, CalendarClock, Landmark, Receipt, X } from "lucide-react";
import type { ComponentType } from "react";
import { industryLabel } from "../data";
import type { CapitalCatalyst, CatalystKind, Company } from "../types";

const CATALYST_ICON: Record<CatalystKind, ComponentType<{ className?: string }>> = {
  usaspending: Landmark,
  ucc_debt: Receipt,
  bdc_maturity: CalendarClock,
};

const TONE_COLOR: Record<CapitalCatalyst["tone"], string> = {
  accent: "var(--color-accent-primary)",
  warn: "var(--color-state-warn)",
  info: "var(--color-state-info)",
};

export function CompanyProfile({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const reduced = !!useReducedMotion();

  return (
    <AnimatePresence>
      {company && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close company profile"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[color:var(--color-surface-overlay)]"
          />

          {/* biome-ignore lint/a11y/useSemanticElements: an animated drawer needs role="dialog" + aria-modal; native <dialog> conflicts with framer-motion AnimatePresence. */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Profile — ${company.name}`}
            className="relative flex h-screen w-full flex-col border-[color:var(--color-border-strong)] border-l bg-[color:var(--color-surface-raised)] shadow-2xl shadow-black/60 sm:w-[460px]"
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduced ? { duration: 0.14 } : { type: "spring", stiffness: 380, damping: 38 }
            }
          >
            <ProfileHeader company={company} onClose={onClose} />
            <ProfileBody company={company} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileHeader({ company, onClose }: { company: Company; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-b px-6 py-4">
      <div className="flex items-center gap-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
        <Building2 className="size-3.5" />
        Federal entity · {company.id}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="-mr-1 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function ProfileBody({ company }: { company: Company }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {/* Identity */}
      <h2 className="font-display font-semibold text-[color:var(--color-text-primary)] text-display-sm uppercase leading-tight tracking-tight">
        {company.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        <span className="text-[color:var(--color-text-accent)]">
          {industryLabel(company.industry)}
        </span>
        {(company.city || company.state) && (
          <>
            <span aria-hidden="true">·</span>
            <span>{[company.city, company.state].filter(Boolean).join(", ")}</span>
          </>
        )}
        {company.activeAward && (
          <span className="border border-[color:var(--color-accent-primary)] px-1.5 py-0.5 text-[color:var(--color-text-accent)] leading-none">
            Active award
          </span>
        )}
      </div>

      {/* Identity facts — live entities carry NAICS + the obligation rollup; the
          seed-only narrative fields (founded / employees / NAICS label) render only
          when present, so the live profile degrades cleanly. */}
      <div className="mt-5 grid grid-cols-2 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
        <IdentityFact
          label="NAICS"
          value={
            company.naicsLabel ? `${company.naics} · ${company.naicsLabel}` : company.naics || "—"
          }
          wide
        />
        {company.founded != null && (
          <IdentityFact label="Founded" value={String(company.founded)} />
        )}
        {company.employees && <IdentityFact label="Employees" value={company.employees} />}
      </div>

      {/* Capital Catalysts */}
      <div className="mt-7 mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.16em]">
          Capital Catalysts
        </h3>
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
          {company.catalysts.length} signal{company.catalysts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {company.catalysts.map((catalyst) => (
          <CatalystCard key={catalyst.kind} catalyst={catalyst} />
        ))}
      </div>
    </div>
  );
}

function IdentityFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`bg-[color:var(--color-surface-raised)] p-3.5 ${wide ? "col-span-2" : ""}`}>
      <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {label}
      </div>
      <div className="mt-1 text-[color:var(--color-text-primary)] text-body-sm leading-snug">
        {value}
      </div>
    </div>
  );
}

function CatalystCard({ catalyst }: { catalyst: CapitalCatalyst }) {
  const Icon = CATALYST_ICON[catalyst.kind];
  const tone = TONE_COLOR[catalyst.tone];

  return (
    <motion.div
      className="border-[color:var(--color-border-subtle)] border-y border-r bg-[color:var(--color-surface-base)]"
      style={{ borderLeft: `3px solid ${tone}` }}
      // The card renders in its final position immediately — no entrance drift. The drawer
      // itself still slides in (motion.aside); only this inner stagger/slide is removed.
      initial={false}
    >
      <div className="px-4 py-4">
        {/* Card header */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center border border-[color:var(--color-border-default)]"
            style={{ color: tone }}
          >
            <Icon className="size-3.5" />
          </span>
          <span className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.12em]">
            {catalyst.label}
          </span>
        </div>

        {/* Headline + summary */}
        <div className="mt-3 font-display font-semibold text-[color:var(--color-text-primary)] text-body-md uppercase leading-snug tracking-tight">
          {catalyst.headline}
        </div>
        <p className="mt-2 text-[color:var(--color-text-muted)] text-body-sm leading-relaxed">
          {catalyst.summary}
        </p>

        {/* Facts */}
        <div className="mt-3.5 grid grid-cols-2 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
          {catalyst.facts.map((fact) => (
            <div key={fact.label} className="bg-[color:var(--color-surface-base)] p-3">
              <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                {fact.label}
              </div>
              <div className="mt-1 text-[color:var(--color-text-primary)] text-body-sm leading-snug">
                {fact.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
