/**
 * MandateDraftShell — the direct-to-documenso Mandate page body at `/app/m/:ref` when `ref` is an
 * engagement_mandate_draft id (no proposal row, no DocRaptor render).
 *
 * It renders the SAME engagement-proposal STRUCTURE as the through-docraptor `MandateEditor` — the
 * shared `DocumentFrame` chrome plus the section scaffold (Prepared for · narrative + parameters ·
 * Commercial Terms · Execution). The field values are editable in-session via the header lock (a
 * look/feel prototype; not persisted, not yet on the prospect view). Editing stays available even
 * after originate — edits are in-session only and don't touch the live document.
 *
 * Approve = the direct "Confirm & Originate" action (no on-page signature). On success it reveals TWO
 * share links:
 *   - "Copy prospect link"  → /p/m/{opp}/{doc}                    (prospect: lands on the summary first)
 *   - "Copy your link"      → /p/m/{opp}/{doc}?signer=originator  (you: straight into YOUR signing embed)
 * The originated link pair is persisted to localStorage (keyed by draftId), so returning to the page
 * re-surfaces both links and blocks an accidental second originate.
 *
 * Origination has two direct-to-documenso lanes (`directToDocumensoLane`, resolved from operator
 * settings):
 *   - 'prefill-document-from-template' (default here): originatePrefilled → returns the
 *     opportunity+document pair → the `/p/m/{opp}/{doc}` links.
 *   - 'embed-template': originateEmbedTemplate → mints NO document, returns the reusable Documenso
 *     DIRECT-TEMPLATE token → the self-serve `/p/t/{opp}/{directToken}` link (the signer
 *     self-identifies; Documenso creates the document on completion).
 * Both lanes converge on the same MandateReadyBar share-link surface.
 */
import { Check, Copy, Lock, LockOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";
import {
  DocumentSummaryScaffold,
  EMPTY_MANDATE_SUMMARY_VALUES,
  type MandateSummaryValues,
} from "@/proposals/DocumentSummaryScaffold";
import { originateEmbedTemplate, originatePrefilled } from "@/proposals/api";
import { useOriginationMode } from "@/settings/originationMode";

type ConfirmStatus = "idle" | "submitting" | "ready" | "error";
// The originated share-link target. The prefill lane carries a numeric documentId (→ /p/m/…); the
// embed-template lane carries the reusable direct-template token (→ /p/t/…). Exactly one is set.
type SignLink = {
  opportunityId: string;
  documentId?: number;
  /** The reusable Documenso DIRECT-TEMPLATE token — set only for the embed-template lane. */
  directToken?: string;
};

// Persist the originated prospect-link pair per draft so returning to the page re-surfaces the share
// links (and blocks an accidental re-originate). In-session prototype scope — the same localStorage
// idiom the through-docraptor editor uses for its draft.
const linkKey = (draftId: string) => `mandate-signlink:${draftId}`;

function loadSignLink(draftId: string | undefined): SignLink | null {
  if (!draftId) return null;
  try {
    const raw = localStorage.getItem(linkKey(draftId));
    return raw ? (JSON.parse(raw) as SignLink) : null;
  } catch {
    return null;
  }
}

function saveSignLink(draftId: string, link: SignLink) {
  try {
    localStorage.setItem(linkKey(draftId), JSON.stringify(link));
  } catch {
    // localStorage unavailable — the links just won't survive a reload.
  }
}

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
  // Which direct-to-documenso lane "Confirm & Originate" runs. The default (or a still-loading null)
  // stays the prefill-document-from-template lane; 'embed-template' switches to the self-serve direct
  // token. The other lanes are routed upstream (this shell only renders under direct-to-documenso).
  const { directToDocumensoLane } = useOriginationMode();

  // Hydrate the originated state from localStorage so returning to the page shows the links + the
  // "Originated" state instead of a fresh Confirm button (which would double-originate).
  const persisted = useMemo(() => loadSignLink(draftId), [draftId]);
  const [status, setStatus] = useState<ConfirmStatus>(persisted ? "ready" : "idle");
  const [signLink, setSignLink] = useState<SignLink | null>(persisted);
  const [error, setError] = useState<string | null>(null);

  // Inline edit prototype — the header lock reveals inline inputs. Editing stays available even after
  // originate (edits are in-session only; they don't touch the live document).
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<MandateSummaryValues>(EMPTY_MANDATE_SUMMARY_VALUES);
  const canEdit = editing;

  async function confirm() {
    // Guard re-originate: already-originated (ready) or in-flight (submitting) is a no-op.
    if (!draftId || status === "submitting" || status === "ready") return;
    setStatus("submitting");
    setError(null);
    try {
      let link: SignLink;
      if (directToDocumensoLane === "embed-template") {
        // EMBED-TEMPLATE lane: mint NO document — get the reusable Documenso DIRECT-TEMPLATE token.
        // The prospect self-identifies in the embed; Documenso creates the document on completion.
        const res = await originateEmbedTemplate(token, draftId);
        if (!res.directToken) {
          throw new Error("originate did not return a direct-template token");
        }
        link = { opportunityId: res.opportunityId, directToken: res.directToken };
      } else {
        // Default — PREFILL-DOCUMENT-FROM-TEMPLATE lane: a document is minted now (returns its id).
        const res = await originatePrefilled(token, draftId);
        if (res.documentId == null) {
          throw new Error("originate did not return a document id");
        }
        link = { opportunityId: res.opportunityId, documentId: res.documentId };
      }
      saveSignLink(draftId, link);
      setSignLink(link);
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
        <DraftEditControls editing={editing} onToggle={() => setEditing((e) => !e)} />
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
                className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-4 font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-40"
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
        action={status === "ready" ? <MandateReadyBar signLink={signLink} /> : null}
      />
    </DocumentFrame>
  );
}

// Header control — the lock toggle (sits where the StatusPill would). Stays available even after
// originate so the operator can re-open it and keep editing the in-session values.
function DraftEditControls({
  editing,
  onToggle,
}: {
  editing: boolean;
  onToggle: () => void;
}) {
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

// Success surface — the share link(s) for the just-originated mandate.
//   - prefill lane: a document exists → prospect link `/p/m/{opp}/{doc}` (lands on the summary) plus
//     "your link" (`?signer=originator`) that drops you into your own signing embed.
//   - embed-template lane: NO document yet → a single self-serve direct link `/p/t/{opp}/{token}`.
//     The signer self-identifies inside the embed; Documenso creates the document on completion. There
//     is no separate "your link" — the same link self-serves both prospect and operator.
function MandateReadyBar({ signLink }: { signLink: SignLink | null }) {
  // embed-template lane — the reusable direct-template token routes to /p/t/{opp}/{token}.
  if (signLink?.directToken) {
    const directUrl = `${window.location.origin}/p/t/${signLink.opportunityId}/${signLink.directToken}`;
    return (
      <div className="mt-8 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
        <div className="mb-3 flex items-center gap-2 text-[color:var(--color-text-accent)]">
          <span className="size-1.5 rounded-full bg-[color:var(--color-state-success)]" />
          <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">
            Direct link ready
          </span>
        </div>
        <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
          Share the direct link. The signer enters their own name and email; the agreement is
          created when they finish signing.
        </p>
        <CopyButton url={directUrl} label="Copy direct link" />
      </div>
    );
  }

  // prefill lane — a minted document → the /p/m/{opp}/{doc} prospect + originator links.
  const prospectUrl = signLink?.documentId
    ? `${window.location.origin}/p/m/${signLink.opportunityId}/${signLink.documentId}`
    : null;
  const yourUrl = prospectUrl ? `${prospectUrl}?signer=originator` : null;

  return (
    <div className="mt-8 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <span className="size-1.5 rounded-full bg-[color:var(--color-state-success)]" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">Document ready</span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
        Share the prospect link; open your link to sign your part.
      </p>
      {prospectUrl && yourUrl ? (
        <div className="grid grid-cols-2 gap-3">
          <CopyButton url={prospectUrl} label="Copy prospect link" />
          <CopyButton url={yourUrl} label="Copy your link" />
        </div>
      ) : (
        <p className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Shareable links are available on the prefill-document lane.
        </p>
      )}
    </div>
  );
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure origin / denied) — the operator can still grab it by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
