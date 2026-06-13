/**
 * MandateProposalScaffold — the shared engagement-proposal document body for the direct-to-documenso
 * mandate. Two surfaces render the SAME structure (Prepared for · Strategic Origination Mandate
 * terms · Execution) so they read identically:
 *
 *   - operator cockpit  (`MandateDraftShell`, /app/m/:ref)  — Execution box = the operator's signature
 *                                                             pad; action = "Confirm & originate".
 *   - prospect entry    (`MandateSignPage`, /p/m/:envelopeId) — Execution box = "Proceed to Proposal"
 *                                                             (reveals the Documenso embed); no action.
 *
 * Only the Execution box content and the optional action below it differ between the two — everything
 * else lives here, so the surfaces stay equivalent as the placeholder term values get wired to real
 * draft data later.
 */
import type { ReactNode } from "react";

export function MandateProposalScaffold({
  execution,
  action,
}: {
  /** Content of the bordered Execution box — the operator's signature pad, or the prospect's
   * "Proceed to Proposal" CTA. */
  execution: ReactNode;
  /** Optional action area below the Execution box (the operator's "Confirm & originate"). */
  action?: ReactNode;
}) {
  return (
    <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
      {/* Prepared for — value pending the draft wiring */}
      <div className="mb-6 border-[color:var(--color-border-subtle)] border-b pb-4">
        <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Prepared for
        </div>
        <div className="text-[0.9375rem] text-[color:var(--color-text-subtle)]">—</div>
      </div>

      {/* Headline terms — fixed labels, values pending. Mirrors the through-docraptor PricingEditor
          (Infrastructure Fee · Term · Billing · Total); the data-driven success-fee tiers are
          omitted until the draft carries them. */}
      <div className="mb-10">
        <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
          Strategic Origination Mandate
        </div>
        <TermRow label="Infrastructure Fee" />
        <TermRow label="Term" />
        <TermRow label="Billing" />
        <TermRow label="Total" />
      </div>

      {/* Execution — the operator signs here; the prospect proceeds to the Documenso document. */}
      <div>
        <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
          Execution
        </div>
        <div className="border border-[color:var(--color-border-subtle)] p-6">{execution}</div>
      </div>

      {action}
    </div>
  );
}

function TermRow({ label }: { label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-3">
      <span className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="text-[0.9375rem] text-[color:var(--color-text-subtle)] tabular-nums">—</span>
    </div>
  );
}
