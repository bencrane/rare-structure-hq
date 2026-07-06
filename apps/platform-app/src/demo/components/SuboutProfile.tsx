/**
 * SuboutProfile — the right-side drawer for a clicked sub-out opportunity dot.
 *
 * v3 wire (relationship matching, NO scoring): the drawer is fully self-contained —
 * the row carries the award facts and the `matched_via` relationship evidence that
 * admitted it (rule A: the target has received subawards from this award's prime,
 * with the $ received; rule B: peer firms — companies that won prime awards in the
 * target's own (agency, code) pairs — have subbed on this award). Rendering the
 * wire verbatim IS the product: nothing is re-derived client-side, and there is
 * no score anywhere because the recipe computes none.
 *
 * Styled on the EntityProfile drawer pattern. Closes on X / backdrop
 * (Esc is handled globally by `DemoApp`).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crosshair, Landmark, X } from "lucide-react";
import { fmtDate, fmtUsd, fmtUsdFull } from "../format";
import type { MatchedVia, SuboutOpportunity } from "../subout";

export function SuboutProfile({
  opportunity,
  targetUei,
  onClose,
}: {
  opportunity: SuboutOpportunity | null;
  targetUei: string | null;
  onClose: () => void;
}) {
  const reduced = !!useReducedMotion();

  return (
    <AnimatePresence>
      {opportunity && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close opportunity detail"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[color:var(--color-surface-overlay)]"
          />

          {/* biome-ignore lint/a11y/useSemanticElements: an animated drawer needs role="dialog" + aria-modal; native <dialog> conflicts with framer-motion AnimatePresence. */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Sub-out opportunity — ${opportunity.prime_name ?? opportunity.award_id_piid ?? "award"}`}
            className="relative flex h-screen w-full flex-col border-[color:var(--color-border-strong)] border-l bg-[color:var(--color-surface-raised)] shadow-2xl shadow-black/60 sm:w-[460px]"
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduced ? { duration: 0.14 } : { type: "spring", stiffness: 380, damping: 38 }
            }
          >
            <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-b px-6 py-4">
              <div className="flex items-center gap-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
                <Crosshair className="size-3.5" />
                Sub-out opportunity{targetUei ? ` · for ${targetUei}` : ""}
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
            <Body opportunity={opportunity} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MatchedViaBlock({ matched }: { matched: MatchedVia[] }) {
  if (matched.length === 0) return null;
  return (
    <Section title="Why it matched">
      <div className="flex flex-col gap-2">
        {matched.map((ev) =>
          ev.rule === "worked_under_prime" ? (
            <div
              key="worked_under_prime"
              className="border border-[color:var(--color-border-subtle)] px-3 py-2"
            >
              <div className="font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
                Worked under this prime
              </div>
              <div className="mt-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                {fmtUsd(ev.subaward_amt_from_prime)} received · {ev.edge_ct} subawards
                {ev.last_action_date ? ` · last ${fmtDate(ev.last_action_date)}` : ""}
              </div>
            </div>
          ) : (
            <div
              key="peer_subawardee"
              className="border border-[color:var(--color-border-subtle)] px-3 py-2"
            >
              <div className="font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
                Peers subbing on this award · {ev.peer_ct}
              </div>
              {ev.peers.map((p) => (
                <div
                  key={p.uei}
                  className="mt-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase"
                >
                  {p.uei} —{" "}
                  {p.shared_pairs
                    .map(
                      (sp) =>
                        `${sp.agency_code}/${sp.code}${sp.code_title ? ` (${sp.code_title})` : ""}`,
                    )
                    .join(", ")}
                </div>
              ))}
              {ev.peer_ct > ev.peers.length && (
                <div className="mt-0.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                  +{ev.peer_ct - ev.peers.length} more peers
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </Section>
  );
}

function Body({ opportunity: o }: { opportunity: SuboutOpportunity }) {
  const end = o.period_of_performance_current_end_date ?? o.ordering_period_end_date;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {/* Identity: the prime + the award */}
      <div className="font-display font-semibold text-[color:var(--color-text-primary)] text-body-lg uppercase tracking-tight">
        {o.prime_name ?? o.prime_uei ?? "Unknown prime"}
      </div>
      <div className="mt-1 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {[o.award_id_piid, o.awarding_agency_name, o.pop_state_code].filter(Boolean).join(" · ")}
      </div>

      <MatchedViaBlock matched={o.matched_via ?? []} />

      {/* Award facts */}
      <Section title="Award">
        <FactRow
          label="Obligated"
          value={o.total_obligation != null ? fmtUsdFull(o.total_obligation) : "—"}
        />
        <FactRow
          label="Ceiling"
          value={
            o.base_and_all_options_value != null ? fmtUsdFull(o.base_and_all_options_value) : "—"
          }
        />
        <FactRow
          label="Already subbing"
          value={
            o.subaward_count
              ? `${o.subaward_count} subawards · ${o.total_subaward_amount != null ? fmtUsd(o.total_subaward_amount) : "—"}`
              : "No reported subawards"
          }
        />
        <FactRow label="Subcontracting plan" value={o.subcontracting_plan_code ?? "—"} />
        <FactRow label="Set-aside" value={o.type_of_set_aside_code ?? "—"} />
        <FactRow label="Ends" value={end ? fmtDate(end) : "—"} />
        <FactRow
          label="Work site"
          value={
            o.distance_mi != null
              ? `${o.distance_mi.toLocaleString("en-US")} mi from HQ (${o.pop_geo_precision ?? "?"})`
              : (o.pop_state_code ?? "Unknown")
          }
        />
      </Section>

      {/* Nearest federal site (informational enrichment) — honestly absent when null */}
      {o.nearest_federal_site && (
        <Section title="Nearest federal site">
          <div className="flex items-start gap-2">
            <Landmark className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-text-muted)]" />
            <div>
              <div className="font-mono text-[color:var(--color-text-primary)] text-mono-xs uppercase">
                {o.nearest_federal_site.site_name ?? "—"}
              </div>
              <div className="mt-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                {[
                  o.nearest_federal_site.site_type,
                  o.nearest_federal_site.distance_mi != null
                    ? `${o.nearest_federal_site.distance_mi} mi from work site`
                    : null,
                  o.nearest_federal_site.lease_expiring_24mo_ct
                    ? `${o.nearest_federal_site.lease_expiring_24mo_ct} leases expiring ≤24mo`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 border-[color:var(--color-border-subtle)] border-b pb-1 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {label}
      </div>
      <div className="text-right font-mono text-[color:var(--color-text-primary)] text-mono-xs tabular-nums">
        {value}
      </div>
    </div>
  );
}
