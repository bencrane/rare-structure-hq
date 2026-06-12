/**
 * MandateDraftShell — the direct-to-documenso Mandate page body at `/app/m/:ref` when `ref` is an
 * engagement_mandate_draft id (no proposal row, no DocRaptor render).
 *
 * It renders the SAME engagement-proposal STRUCTURE as the through-docraptor `MandateEditor` — the
 * shared `DocumentFrame` chrome (utility bar · "Engagement Proposal" letterhead · trust-strip
 * footer) plus the section scaffold (Prepared for · the mandate terms · Execution · the originate
 * action) — but every data slot is intentionally blank and the actions are inert. The draft's
 * concrete values and its sign/confirm wiring are a separate step; until then this gives the
 * operator the full structural shell instead of the previously-blank page.
 *
 * Static + dataless on purpose: it takes no `shell` and fetches nothing, so it can never 404 or
 * flash. Lives in `proposals/` (not `routes/`) so it may own page geometry like its siblings.
 */
import { PenLine } from "lucide-react";

import { DocumentFrame } from "@/proposals/DocumentFrame";

export function MandateDraftShell({
  housing = "standalone",
}: {
  /** Forwarded to DocumentFrame. `"cockpit"` only when mounted in the Mandate page. */
  housing?: "standalone" | "cockpit";
}) {
  return (
    <DocumentFrame title="Engagement Proposal" maxWidthClass="max-w-[820px]" housing={housing}>
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        {/* Prepared for — value pending the draft wiring */}
        <div className="mb-6 border-[color:var(--color-border-subtle)] border-b pb-4">
          <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
            Prepared for
          </div>
          <Pending />
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

        {/* Execution — the structural signature block; signing is wired with the draft path. */}
        <div>
          <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            Execution
          </div>
          <div className="border border-[color:var(--color-border-subtle)] p-6">
            <div className="mb-2.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Signature
            </div>
            <button
              type="button"
              disabled
              className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] disabled:opacity-40"
            >
              <PenLine className="size-4" />
              Sign the mandate
            </button>
            <div className="mt-3 text-[0.875rem] text-[color:var(--color-text-primary)]">
              Rare Structure LLC
            </div>
          </div>
        </div>

        {/* Action — present structurally, inert until the draft originate path is defined. */}
        <div className="mt-8">
          <button
            type="button"
            disabled
            className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 text-center font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] disabled:opacity-40"
          >
            Confirm &amp; originate
          </button>
        </div>
      </div>
    </DocumentFrame>
  );
}

// A blank value slot — an em-dash in subtle ink, reading as "to be filled" rather than missing.
function Pending() {
  return <div className="text-[0.9375rem] text-[color:var(--color-text-subtle)]">—</div>;
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
