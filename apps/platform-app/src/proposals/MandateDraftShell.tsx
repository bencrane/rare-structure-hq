/**
 * MandateDraftShell — the direct-to-documenso Mandate page body at `/app/m/:ref` when `ref` is an
 * engagement_mandate_draft id (no proposal row, no DocRaptor render).
 *
 * It renders the SAME engagement-proposal STRUCTURE as the through-docraptor `MandateEditor` — the
 * shared `DocumentFrame` chrome (utility bar · "Engagement Summary" letterhead · trust-strip footer)
 * plus the section scaffold (Prepared for · the mandate narrative + parameters · Commercial Terms ·
 * Execution). The field values are editable in-session via the header lock (a look/feel prototype;
 * not persisted, not yet on the prospect view).
 *
 * Approve = the direct "Confirm & Originate" action: it originates the document IMMEDIATELY (no on-page
 * signature step — the binding originator counter-signature is Documenso's). WHICH lane it uses is the
 * operator's `directToDocumensoLane` setting:
 *   - 'envelope-distribute'  (default): confirmMandateDraft → BFF → edge_api /envelope/use + distribute.
 *   - 'prefill-document-from-template': originatePrefilled → BFF → edge_api /api/v2/template/use,
 *                                       prefilled + distribute(NONE) → PENDING (no email).
 * The prospect link is `/p/m/{opportunityId}/{documentId}`: the opportunity UUID is the unguessable
 * access capability, the numeric document id a disambiguator behind it. Both come off the
 * prefill-lane originate response (`originatePrefilled`), so the link is built directly from it.
 */
import { Check, Copy, ExternalLink, Lock, LockOpen } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";
import {
  DocumentSummaryScaffold,
  EMPTY_MANDATE_SUMMARY_VALUES,
  type MandateSummaryValues,
} from "@/proposals/DocumentSummaryScaffold";
import { confirmMandateDraft, originatePrefilled } from "@/proposals/api";
import { useOriginationMode } from "@/settings/originationMode";

type ConfirmStatus = "idle" | "submitting" | "ready" | "error";

export function MandateDraftShell({
  draftId,
  housing = "standalone",
}: {
  /** The engagement_mandate_draft id this page is keyed to — drives "Confirm & Originate". */
  draftId?: string;
  /** Forwarded to DocumentFrame. `"cockpit"` only when mounted in the Mandate page. */
  housing?: "standalone" | "cockpit";
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  // The persisted direct-to-documenso sub-lane decides which originate endpoint Confirm calls. Falls
  // back to the envelope-distribute default until loaded (and under the DEV mock session).
  const { directToDocumensoLane } = useOriginationMode();
  const [status, setStatus] = useState<ConfirmStatus>("idle");
  // The originated prospect-link pair. The link is /p/m/{opportunityId}/{documentId}; only the
  // prefill lane stamps the opportunity UUID as the envelope's externalId AND returns the numeric
  // document id, so only it can build the pair link.
  const [signLink, setSignLink] = useState<{ opportunityId: string; documentId: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // ── Inline edit prototype ──────────────────────────────────────────────────────────────────────
  // The header lock toggle reveals inline inputs for the mandate fields. Values are in-session only
  // (not persisted, not yet wired to the draft or the prospect view) — this is the operator's "add the
  // values and see how it looks" prototype. Editing locks once originating/ready.
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<MandateSummaryValues>(EMPTY_MANDATE_SUMMARY_VALUES);
  const finalized = status === "submitting" || status === "ready";
  const canEdit = editing && !finalized;

  async function confirm() {
    if (!draftId || status === "submitting" || status === "ready") return;
    setStatus("submitting");
    setError(null);
    try {
      // Branch on the lane: prefill-document-from-template → the prefill endpoint (returns the
      // opportunity UUID + numeric document id → the pair link). Everything else (incl. the
      // unloaded/default case) → the envelope-distribute confirm.
      if (directToDocumensoLane === "prefill-document-from-template") {
        const res = await originatePrefilled(token, draftId);
        if (res.documentId == null) {
          throw new Error("originate did not return a document id");
        }
        setSignLink({ opportunityId: res.opportunityId, documentId: res.documentId });
      } else {
        await confirmMandateDraft(token, draftId);
        // The envelope-distribute lane stamps externalId=draftId (not the opportunity UUID) and does
        // not return the pair, so it cannot build the /p/m/{opportunity}/{document} link.
        setSignLink(null);
      }
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not originate the mandate");
      setStatus("error");
    }
  }

  return (
    <DocumentFrame
      title="Engagement Summary"
      maxWidthClass="max-w-[820px]"
      housing={housing}
      headerAccessory={
        <DraftEditControls
          finalized={finalized}
          editing={editing}
          onToggle={() => setEditing((e) => !e)}
        />
      }
    >
      <DocumentSummaryScaffold
        values={values}
        editable={canEdit}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        execution={
          <>
            <div className="mb-2.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Approve
            </div>
            {status === "ready" ? (
              <div className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em]">
                <Check className="size-4" />
                Originated
              </div>
            ) : (
              <button
                type="button"
                onClick={confirm}
                disabled={!draftId || status === "submitting"}
                className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "submitting"
                  ? "Originating…"
                  : status === "error"
                    ? "Retry — Confirm & Originate"
                    : "Confirm & Originate"}
              </button>
            )}
            {error ? (
              <p className="mt-2 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                Rare Structure LLC
              </span>
            </div>
          </>
        }
        // Success surface — the prospect share link for the just-created Documenso document.
        action={status === "ready" ? <MandateReadyBar signLink={signLink} /> : null}
      />
    </DocumentFrame>
  );
}

// Header control — the lock toggle (sits where the StatusPill would). Click to reveal the inline field
// inputs; once originating/ready the terms are locked in and it shows a static "Locked" pill.
function DraftEditControls({
  finalized,
  editing,
  onToggle,
}: {
  finalized: boolean;
  editing: boolean;
  onToggle: () => void;
}) {
  if (finalized)
    return (
      <span className="flex shrink-0 items-center gap-1.5 border border-[color:var(--color-border-default)] px-2.5 py-1 font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
        <Lock className="size-3" />
        Locked
      </span>
    );
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={editing ? "Lock terms" : "Edit terms"}
      className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] transition-colors ${
        editing
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-accent)]"
      }`}
    >
      {editing ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
    </button>
  );
}

// Success surface — the prospect share link for the just-created Documenso document. The link is
// `/p/m/{opportunityId}/{documentId}`: the opportunity UUID is the unguessable access capability, the
// numeric document id a disambiguator behind it. `signLink` is null for the envelope-distribute lane
// (it doesn't stamp the opportunity pair).
function MandateReadyBar({
  signLink,
}: {
  signLink: { opportunityId: string; documentId: number } | null;
}) {
  const url = signLink
    ? `${window.location.origin}/p/m/${signLink.opportunityId}/${signLink.documentId}`
    : null;
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
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
        The agreement is live and ready for signature.
      </p>
      {url ? (
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
      ) : (
        <p className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Shareable link is available on the prefill-document lane.
        </p>
      )}
    </div>
  );
}
