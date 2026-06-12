/**
 * MandateDraftShell — the direct-to-documenso Mandate page body at `/app/m/:ref` when `ref` is an
 * engagement_mandate_draft id (no proposal row, no DocRaptor render).
 *
 * It renders the SAME engagement-proposal STRUCTURE as the through-docraptor `MandateEditor` — the
 * shared `DocumentFrame` chrome (utility bar · "Engagement Proposal" letterhead · trust-strip
 * footer) plus the section scaffold (Prepared for · the mandate terms · Execution · the originate
 * action). The headline-term values are intentionally blank pending the draft wiring.
 *
 * Execution is LIVE: the operator can sign (the same performative, cosmetic gate as the editor — it
 * binds nothing; the real originator counter-signature is Documenso's), reusing `SignatureOverlay`.
 * The signature is in-session only (not persisted). "Confirm & originate" stays inert until the
 * draft's direct-to-documenso originate path is defined.
 */
import { PenLine } from "lucide-react";
import { useState } from "react";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { SignatureOverlay } from "@/proposals/SignaturePad";

export function MandateDraftShell({
  housing = "standalone",
}: {
  /** Forwarded to DocumentFrame. `"cockpit"` only when mounted in the Mandate page. */
  housing?: "standalone" | "cockpit";
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

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

        {/* Execution — the operator signs in the moment (performative, like the editor). */}
        <div>
          <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            Execution
          </div>
          <div className="border border-[color:var(--color-border-subtle)] p-6">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
                Signature
              </span>
              {signature && (
                <button
                  type="button"
                  onClick={() => {
                    setSignature(null);
                    setSignedAt(null);
                  }}
                  className="font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]"
                >
                  Re-sign
                </button>
              )}
            </div>
            {signature ? (
              <div className="flex h-[84px] items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)]">
                <img src={signature} alt="Originator signature" className="max-h-[72px] w-auto" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSigning(true)}
                className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
              >
                <PenLine className="size-4" />
                Sign the mandate
              </button>
            )}
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                Rare Structure LLC
              </span>
              {signedAt && (
                <span className="text-[0.75rem] text-[color:var(--color-text-muted)] tabular-nums">
                  {formatDate(signedAt)}
                </span>
              )}
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

      {signing && (
        <SignatureOverlay
          onApply={(dataUrl) => {
            setSignature(dataUrl);
            setSignedAt(new Date().toISOString());
            setSigning(false);
          }}
          onCancel={() => setSigning(false)}
        />
      )}
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
