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
 * The signature is in-session only (not persisted). "Confirm & originate" is the REAL direct-to-
 * documenso originate. WHICH lane it uses is the operator's `directToDocumensoLane` setting:
 *   - 'envelope-distribute'  (default): confirmMandateDraft → BFF → edge_api /envelope/use + distribute.
 *   - 'template-prefill-draft'        : originatePrefilledDraft → BFF → edge_api /api/v2/template/use,
 *                                       prefilled + NOT distributed (stays DRAFT).
 * Both return the envelope id + token, so the downstream is identical: reveal `/p/m/:envelopeId`.
 */
import { Check, Copy, ExternalLink, PenLine } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";
import { MandateProposalScaffold } from "@/proposals/MandateProposalScaffold";
import { SignatureOverlay } from "@/proposals/SignaturePad";
import { confirmMandateDraft, originatePrefilledDraft } from "@/proposals/api";
import { useOriginationMode } from "@/settings/originationMode";

type ConfirmStatus = "idle" | "submitting" | "ready" | "error";

export function MandateDraftShell({
  draftId,
  housing = "standalone",
}: {
  /** The engagement_mandate_draft id this page is keyed to — drives "Confirm & originate". */
  draftId?: string;
  /** Forwarded to DocumentFrame. `"cockpit"` only when mounted in the Mandate page. */
  housing?: "standalone" | "cockpit";
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  // The persisted direct-to-documenso sub-lane decides which originate endpoint Confirm calls. Falls
  // back to the envelope-distribute default until loaded (and under the DEV mock session).
  const { directToDocumensoLane } = useOriginationMode();
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [status, setStatus] = useState<ConfirmStatus>("idle");
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!draftId || !signature || status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      // Branch on the lane: template-prefill-draft → the prefilled-DRAFT endpoint; everything else
      // (incl. the unloaded/default case) → the existing envelope-distribute confirm. Both return the
      // envelope id (the prospect-link capability), so the success path is identical.
      const res =
        directToDocumensoLane === "template-prefill-draft"
          ? await originatePrefilledDraft(token, draftId)
          : await confirmMandateDraft(token, draftId);
      setEnvelopeId(res.envelopeId);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not originate the mandate");
      setStatus("error");
    }
  }

  return (
    <DocumentFrame title="Engagement Proposal" maxWidthClass="max-w-[820px]" housing={housing}>
      <MandateProposalScaffold
        execution={
          <>
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
          </>
        }
        action={
          // Confirm → instantiate the Documenso document → reveal the prospect link. Gated on the
          // on-page signature (cosmetic, but the operator signs every time, like the editor).
          <DraftConfirmBar
            draftId={draftId}
            hasSignature={!!signature}
            status={status}
            error={error}
            envelopeId={envelopeId}
            onSubmit={confirm}
          />
        }
      />

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

// Confirm → submitting → ready lifecycle. Mirrors MandateEditor's DraftActionBar, simplified for the
// stateless draft path: success reveals the prospect link rather than a re-derivable proposal ref.
function DraftConfirmBar({
  draftId,
  hasSignature,
  status,
  error,
  envelopeId,
  onSubmit,
}: {
  draftId?: string;
  hasSignature: boolean;
  status: ConfirmStatus;
  error: string | null;
  envelopeId: string | null;
  onSubmit: () => void;
}) {
  if (status === "ready" && envelopeId) return <MandateReadyBar envelopeId={envelopeId} />;

  if (status === "submitting") {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] py-4 font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em]">
        <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--color-text-subtle)]" />
        Originating — creating the Documenso document…
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onSubmit}
        disabled={!hasSignature || !draftId}
        className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 text-center font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
      >
        {status === "error" ? "Retry — confirm & originate" : "Confirm & originate"}
      </button>
      {error ? (
        <p className="mt-2 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Success surface — the prospect share link for the just-created Documenso document. The envelope id
// is the capability carried in `/p/m/:envelopeId`. Mirrors MandateEditor's ReadyBar (copy + open).
function MandateReadyBar({ envelopeId }: { envelopeId: string }) {
  const url = `${window.location.origin}/p/m/${envelopeId}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure origin / denied) — the link stays visible to copy by hand.
    }
  }

  return (
    <div className="mt-8 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <span className="size-1.5 rounded-full bg-[color:var(--color-state-success)]" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">Document ready</span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
        The agreement is live in Documenso. Share the link on the call, or send it yourself when
        you're ready to close.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          <ExternalLink className="size-3.5" />
          Open as client
        </a>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
