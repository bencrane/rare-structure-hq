/**
 * DirectTemplateSignPage — the prospect's direct-to-documenso self-serve signing view at
 * `/p/t/:opportunityId/:directToken`.
 *
 * The embed-template ANALOG of `DocumentSignPage` (do not confuse: that one is the prefill-document
 * lane, keyed by a minted `(opportunityId, documentId)` pair and rendered via `EmbedSignDocument`).
 * This lane mints NO document up front — the operator's "Confirm & originate" returns a reusable
 * Documenso DIRECT-TEMPLATE token, and Documenso creates the document only when the signer completes
 * the embed (source=TEMPLATE_DIRECT_LINK). The prospect lands on the SAME engagement-proposal scaffold
 * the operator sees (`DocumentSummaryScaffold`), then clicks "Proceed to Proposal" to reveal the
 * token-driven `EmbedDirectTemplate` (the actual agreement), reusing the same theme + `DocumentFrame`
 * chrome the rest of the flow uses.
 *
 * HOW THIS PAGE GETS THE direct_token: from the URL PATH (`:directToken`). The direct-template token is
 * REUSABLE and not document-specific, so — unlike DocumentSignPage, which fetches a pair-gated token via
 * getMandateSignToken because a document already exists — there is nothing to fetch here at load. The
 * token IS the capability and is carried in the shareable link the operator copies
 * (`/p/t/{opp}/{directToken}`, built by MandateDraftShell's MandateReadyBar). The opportunity handle is
 * passed as externalId so the document Documenso mints inherits it (keeping the offline sign-state
 * derivation pair-able).
 *
 * KEY DIFFERENCES from DocumentSignPage:
 *   - `EmbedDirectTemplate` (not `EmbedSignDocument`).
 *   - The signer SELF-IDENTIFIES (enters name + email) — so we do NOT lockName/lockEmail.
 *   - `onDocumentCompleted` returns the NEW numeric `documentId`; only THEN do we switch to the
 *     server-truth `getMandateSignState(opportunityId, documentId)` poll (the same offline,
 *     ZERO-Documenso-call derivation DocumentSignPage uses). Before completion there is no document id
 *     to poll, so the poll cannot start at load (it does in DocumentSignPage because the document
 *     pre-exists).
 *
 * Deliberately renders a SIMPLER post-sign confirmation than DocumentSignPage's full payment flow —
 * the bar for this lane is "a clean confirmation loads on signing."
 */
import { EmbedDirectTemplate } from "@documenso/embed-react";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { DocumentSummaryScaffold } from "@/proposals/DocumentSummaryScaffold";
import { getMandateSignState } from "@/proposals/api";
import {
  DOCUMENSO_CSS_VARS,
  DOCUMENSO_DEFAULT_HOST,
  DOCUMENSO_EMBED_CSS,
} from "@/proposals/documensoTheme";

type LoadState = "loading" | "ready" | "notfound";

// How often the prospect poll asks the server "is this document signed yet?" once the embed reports a
// completion (and hands us the new numeric document id). Server-truth only — derived from the Documenso
// webhook capture, NOT the browser onDocumentCompleted event (which can fire before the sealed/COMPLETED
// state is durable). Mirrors DocumentSignPage's SIGNED_POLL_MS.
const SIGNED_POLL_MS = 4000;

export default function DirectTemplateSignPage() {
  const { opportunityId, directToken } = useParams<{
    opportunityId: string;
    directToken: string;
  }>();
  const [searchParams] = useSearchParams();
  // Optional prefill carried on the link (the signer can still edit — name/email are NOT locked in this
  // lane). The operator can append `?email=…&name=…` when sharing; both are optional.
  const prefillEmail = searchParams.get("email") ?? undefined;
  const prefillName = searchParams.get("name") ?? undefined;

  const [state] = useState<LoadState>(directToken ? "ready" : "notfound");
  const [proceed, setProceed] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);
  // The numeric document id Documenso assigns when the signer completes the embed. Until it lands there
  // is nothing to poll — the embed-template lane has no document up front.
  const [documentId, setDocumentId] = useState<number | null>(null);
  // Server-confirmed terminal state. Once true the embed is replaced by the signed-confirmation view.
  const [signed, setSigned] = useState(false);
  // Display-only: the embed's completion event raises a "Finalizing…" veil over the embed while the
  // server poll catches up. It does NOT advance the page — only the server `signed` truth does that.
  const [finalizing, setFinalizing] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Server-truth signed poll. UNLIKE DocumentSignPage, this cannot run at load — there is no document
  // until the signer completes the embed. It starts only once onDocumentCompleted hands us the new
  // numeric document id, then reads the offline `/sign-state` derivation (ZERO Documenso calls, pair-
  // gated on (opportunityId, documentId)). Stops the moment the server reports `signed`. Idiom lifted
  // verbatim from DocumentSignPage (useRef interval, immediate probe, cleared on unmount + terminal).
  useEffect(() => {
    const live = !!opportunityId && documentId != null && !signed;
    if (!live) return;
    const docId = String(documentId);
    const tick = async () => {
      const s = await getMandateSignState(opportunityId, docId).catch(() => null);
      if (s?.signed) {
        setSigned(true);
        if (pollTimer.current) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      }
    };
    void tick(); // probe immediately
    pollTimer.current = setInterval(() => void tick(), SIGNED_POLL_MS);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [opportunityId, documentId, signed]);

  // Safety net: if the embed never fires onDocumentReady (slow network / edge), drop the veil after a
  // beat so the prospect is never stranded on the loading state. (Same idiom as DocumentSignPage.)
  useEffect(() => {
    if (!proceed || embedReady) return;
    const t = setTimeout(() => setEmbedReady(true), 12000);
    return () => clearTimeout(t);
  }, [proceed, embedReady]);

  // The embed (the actual agreement) takes over only after the prospect proceeds; until then the page
  // mirrors the operator's mandate scaffold. Once the server confirms `signed`, the signed-confirmation
  // view replaces the embed (still inside this frame).
  const showingEmbed = state === "ready" && !!directToken && proceed && !signed;

  let body: React.ReactNode;
  if (signed) {
    // Server-confirmed signed. Deliberately a simpler post-sign confirmation than DocumentSignPage's
    // payment flow — this lane's bar is "a clean confirmation loads on signing."
    body = (
      <div className="flex min-h-[78vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-6 font-mono text-[1.25rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
          Agreement signed
        </h2>
        <p className="mt-4 max-w-[480px] font-mono text-[0.875rem] text-[color:var(--color-text-muted)] leading-relaxed tracking-[0.06em]">
          Your engagement agreement has been signed and recorded. A fully executed copy will be sent
          to your email.
        </p>
      </div>
    );
  } else if (state === "notfound" || !directToken) {
    body = <BodyNote>This mandate link is invalid or has expired.</BodyNote>;
  } else if (!proceed) {
    // Mirror the operator's mandate scaffold; the Execution box carries the prospect's CTA in place of
    // the signature pad. Content values are placeholders pending the draft-data wiring.
    body = (
      <DocumentSummaryScaffold
        execution={
          <button
            type="button"
            onClick={() => setProceed(true)}
            className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
          >
            Proceed to Proposal →
          </button>
        }
      />
    );
  } else {
    // Load the embed behind a dark, branded veil; reveal it only once Documenso signals the document is
    // ready — so the prospect never sees the iframe's white, unstyled loading flash. The container and
    // the iframe both carry the dark surface bg as belt-and-suspenders; the iframe fades in.
    body = (
      <div className="relative min-h-[78vh] w-full bg-[color:var(--color-surface-base)]">
        <EmbedDirectTemplate
          token={directToken}
          host={DOCUMENSO_DEFAULT_HOST}
          // The opportunity handle rides as externalId so the document Documenso mints on completion
          // inherits it — keeping the offline sign-state derivation pair-able by (externalId, documentId).
          externalId={opportunityId}
          darkModeDisabled={false}
          // The signer SELF-IDENTIFIES on this lane — do NOT lock name/email. Optional prefill (editable)
          // can be carried on the link via ?email=&name=.
          email={prefillEmail}
          name={prefillName}
          cssVars={DOCUMENSO_CSS_VARS}
          css={DOCUMENSO_EMBED_CSS}
          className={`h-full min-h-[78vh] w-full border-0 bg-[color:var(--color-surface-base)] transition-opacity duration-300 ${
            embedReady ? "opacity-100" : "opacity-0"
          }`}
          onDocumentReady={() => setEmbedReady(true)}
          // Capture the NEW numeric document id Documenso just created from the template, then raise the
          // "Finalizing…" veil and start the server-truth poll. The advance is gated on the server
          // `signed` truth (the poll), NEVER on this browser event.
          onDocumentCompleted={({ documentId: newDocumentId }) => {
            setDocumentId(newDocumentId);
            setFinalizing(true);
          }}
          onDocumentError={(e) => {
            console.error("documenso direct-template sign error", e);
            setEmbedReady(true);
          }}
        />
        {!embedReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-surface-base)]">
            <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.18em]">
              Preparing your agreement…
            </div>
          </div>
        )}
        {finalizing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-surface-base)]">
            <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.18em]">
              Finalizing your agreement…
            </div>
          </div>
        )}
      </div>
    );
  }

  // The frame's StatusPill reflects the signing state: once the server confirms `signed` it reads
  // "Signed"; until then it shows the default "Awaiting signature".
  return (
    <DocumentFrame
      title={signed || showingEmbed ? "Engagement Agreement" : "Engagement Proposal"}
      status={signed ? "signed" : undefined}
      onBack={showingEmbed ? () => setProceed(false) : undefined}
      maxWidthClass={signed ? "max-w-[920px]" : showingEmbed ? "max-w-[1152px]" : "max-w-[820px]"}
    >
      {body}
    </DocumentFrame>
  );
}

function BodyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[78vh] items-center justify-center text-center">
      <div className="max-w-[420px] px-6 font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.18em]">
        {children}
      </div>
    </div>
  );
}
