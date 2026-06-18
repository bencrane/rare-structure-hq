/**
 * DocumentSummaryScaffold — the shared engagement-proposal document body for the direct-to-documenso
 * mandate. Two surfaces render the SAME structure so they read identically:
 *
 *   - operator cockpit  (`MandateDraftShell`, /app/m/:ref)  — Execution box = the operator's signature
 *                                                             pad; action = "Confirm & originate".
 *   - prospect entry    (`DocumentSignPage`, /p/m/:envelopeId) — Execution box = "Proceed to Proposal"
 *                                                             (reveals the Documenso embed); no action.
 *
 * Sections: Prepared for · Strategic Origination Mandate (narrative) · Mandate Parameters ·
 * Commercial Terms · Execution. Only the Execution box content and the optional action below it differ
 * between the two surfaces — everything else lives here, so the surfaces stay equivalent as the
 * placeholder copy/values get wired to real draft data later.
 */
import type { ReactNode } from "react";

export function DocumentSummaryScaffold({
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
      <div className="mb-10 border-[color:var(--color-border-subtle)] border-b pb-4">
        <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Prepared for
        </div>
        <div className="text-[0.9375rem] text-[color:var(--color-text-subtle)]">—</div>
      </div>

      {/* Strategic Origination Mandate — the mandate narrative. */}
      <div className="mb-10">
        <SectionHeading>Strategic Origination Mandate</SectionHeading>
        <p className="text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.65]">
          Active Operators will allocate localized routing capacity exclusively to Acme Corp. This
          mandate establishes a dedicated information channel for identifying high-probability
          corporate inflection points prior to broader market awareness.
        </p>
      </div>

      {/* Mandate Parameters — fixed labels, values pending the draft wiring. */}
      <div className="mb-10">
        <SectionHeading>Mandate Parameters</SectionHeading>
        <TermRow label="Target Market" />
        <TermRow label="Key Inflection Points" />
        <TermRow label="Core Capabilities" />
        <TermRow label="Regional Activity" />
      </div>

      {/* Commercial Terms — fixed labels, values pending the draft wiring. */}
      <div className="mb-10">
        <SectionHeading>Commercial Terms</SectionHeading>
        <TermRow label="Data Infrastructure Fee" />
        <TermRow label="Access Allocation Payment" />
        <TermRow label="Term Duration" />
        <TermRow label="Billing Cadence" />
        <TermRow label="Total" />
      </div>

      {/* Execution — the operator signs here; the prospect proceeds to the Documenso document. */}
      <div>
        <SectionHeading>Execution</SectionHeading>
        <div className="border border-[color:var(--color-border-subtle)] p-6">{execution}</div>
      </div>

      {action}
    </div>
  );
}

// Section heading — the blue accent label (the "Strategic Origination Mandate" style). Shared by every
// section so the document reads as one system.
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
      {children}
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
