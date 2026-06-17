/**
 * DocumentSignPage — the prospect's direct-to-documenso signing view at
 * `/p/m/:opportunityId/:documentId`.
 *
 * The direct-to-documenso counterpart to `SignPage`. The operator's "Confirm & originate"
 * instantiates a Documenso document from the engagement template and shares this link. The
 * opportunity UUID is the unguessable access capability; the numeric document id is a disambiguator
 * BEHIND it. The prospect lands on the SAME engagement-proposal scaffold the operator sees
 * (`DocumentSummaryScaffold`) — except the Execution box, instead of a signature pad, shows
 * "Proceed to Proposal"; clicking it reveals the token-driven Documenso embed (the actual agreement),
 * reusing the same theme + `DocumentFrame` chrome the proposal flow uses.
 *
 * The embed token is fetched ONCE at load via the pair-gated token endpoint (the only Documenso
 * call); the "am I signed?" poll reads the offline `/sign-state` derivation — ZERO Documenso calls
 * in the poll loop.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { DocumentSummaryScaffold } from "@/proposals/DocumentSummaryScaffold";
import {
  type MandateSignToken,
  getMandateSignState,
  getMandateSignToken,
} from "@/proposals/api";
import {
  DOCUMENSO_CSS_VARS,
  DOCUMENSO_DEFAULT_HOST,
  DOCUMENSO_EMBED_CSS,
} from "@/proposals/documensoTheme";

type LoadState = "loading" | "ready" | "notfound";

// How often the prospect poll asks the server "is this envelope signed yet?" while the embed is up.
// Server-truth only — derived from the Documenso webhook capture, NOT a browser onDocumentCompleted
// listener (the embed event can fire before the sealed/COMPLETED state is durable, and signing can
// also complete on a different device/tab than the one holding this embed).
const SIGNED_POLL_MS = 4000;

export default function DocumentSignPage() {
  const { opportunityId, documentId } = useParams<{
    opportunityId: string;
    documentId: string;
  }>();
  const [doc, setDoc] = useState<MandateSignToken | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [proceed, setProceed] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);
  // Server-confirmed terminal state. Once true the embed is replaced by the signed-confirmation view.
  const [signed, setSigned] = useState(false);
  // Display-only: the embed's completion event raises a "Finalizing…" veil over the embed while the
  // server poll catches up. It does NOT advance the page — only the server `signed` truth does that.
  const [finalizing, setFinalizing] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!opportunityId || !documentId) {
      setState("notfound");
      return;
    }
    let active = true;
    // ONE-TIME pair-gated token read at load (the only Documenso call). 404 ⇒ invalid pair / unknown.
    getMandateSignToken(opportunityId, documentId)
      .then((d) => {
        if (!active) return;
        if (!d) {
          setState("notfound");
          return;
        }
        setDoc(d);
        setState("ready");
      })
      .catch(() => active && setState("notfound"));
    return () => {
      active = false;
    };
  }, [opportunityId, documentId]);

  // Server-truth signed poll. Runs from initial load (NOT gated on `proceed`) so an already-signed
  // prospect who refreshes or returns to the link lands straight on the confirmation — the immediate
  // probe sets `signed` and the body renders `DocumentSignedConfirmation` before the `!proceed`
  // scaffold. Stops the moment the server reports `signed`. The state endpoint derives signed from the
  // raw Documenso webhook capture — the page advances on durable server truth, never on a browser
  // embed event. Idiom lifted from PaymentPage's authoritative-state poll (useRef interval, cleared on
  // unmount and on terminal state).
  useEffect(() => {
    const live = state === "ready" && !!doc?.signingToken && !signed;
    if (!opportunityId || !documentId || !live) return;
    const tick = async () => {
      // OFFLINE on the server — derived from the raw webhook capture, ZERO Documenso calls. `signed`
      // requires the (opportunity, document) pair to match.
      const s = await getMandateSignState(opportunityId, documentId).catch(() => null);
      if (s?.signed) {
        setSigned(true);
        if (pollTimer.current) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      }
    };
    void tick(); // probe immediately (covers the already-signed reload case)
    pollTimer.current = setInterval(() => void tick(), SIGNED_POLL_MS);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [opportunityId, documentId, state, doc?.signingToken, signed]);

  // Safety net: if the embed never fires onDocumentReady (slow network / edge), drop the veil after a
  // beat so the prospect is never stranded on the loading state.
  useEffect(() => {
    if (!proceed || embedReady) return;
    const t = setTimeout(() => setEmbedReady(true), 12000);
    return () => clearTimeout(t);
  }, [proceed, embedReady]);

  // The embed (the actual agreement) takes over only after the prospect proceeds; until then the page
  // mirrors the operator's mandate scaffold. The embed needs a wide two-column frame; the scaffold a
  // narrow reading column. Once the server confirms `signed`, the signed-confirmation view replaces
  // the embed (still inside this frame, still wide).
  const showingEmbed = state === "ready" && !!doc?.signingToken && proceed;

  let body: React.ReactNode;
  if (signed) {
    // Server-confirmed terminal state — the new direct-to-documenso post-sign confirmation, rendered
    // in place (no docraptor/proposal post-sign components, no `ref` keying — this flow is keyed by
    // the envelope id alone).
    body = (
      <DocumentSignedConfirmation
        opportunityId={opportunityId ?? ""}
        documentId={documentId ?? ""}
      />
    );
  } else if (state === "loading") {
    body = <BodyNote>Preparing the agreement…</BodyNote>;
  } else if (state === "notfound" || !doc) {
    body = <BodyNote>This mandate link is invalid or has expired.</BodyNote>;
  } else if (!doc.signingToken) {
    body = <BodyNote>Document is being prepared — check back in a moment.</BodyNote>;
  } else if (!proceed) {
    // Mirror the operator's mandate scaffold; the Execution box carries the prospect's CTA in place
    // of the signature pad. Content values are placeholders pending the draft-data wiring.
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
    // Load the embed behind a dark, branded veil; reveal it only once Documenso signals the document
    // is ready — so the prospect never sees the iframe's white, unstyled loading flash. The container
    // and the iframe both carry the dark surface bg as belt-and-suspenders; the iframe fades in.
    body = (
      <div className="relative min-h-[78vh] w-full bg-[color:var(--color-surface-base)]">
        <EmbedSignDocument
          token={doc.signingToken}
          host={doc.documensoHost ?? DOCUMENSO_DEFAULT_HOST}
          darkModeDisabled={false}
          cssVars={DOCUMENSO_CSS_VARS}
          css={DOCUMENSO_EMBED_CSS}
          className={`h-full min-h-[78vh] w-full border-0 bg-[color:var(--color-surface-base)] transition-opacity duration-300 ${
            embedReady ? "opacity-100" : "opacity-0"
          }`}
          onDocumentReady={() => setEmbedReady(true)}
          // Display-only hint: raise the "Finalizing…" veil immediately on the in-frame completion so
          // the prospect isn't staring at a signed-but-static embed during the poll gap. The actual
          // advance is gated on the server `signed` truth (the poll), never on this event.
          onDocumentCompleted={() => setFinalizing(true)}
          onDocumentError={(e) => {
            console.error("documenso sign error", e);
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
  // "Signed" (executed styling); until then it shows the default "Awaiting signature". (Documenso's
  // PENDING/COMPLETED envelope status is NOT forwarded — only the binary signed truth, which maps
  // cleanly onto the pill's "signed" lifecycle value.)
  return (
    <DocumentFrame
      title={signed || showingEmbed ? "Engagement Agreement" : "Engagement Proposal"}
      status={signed ? "signed" : undefined}
      backHref={opportunityId && documentId ? `/p/m/${opportunityId}/${documentId}` : undefined}
      maxWidthClass={showingEmbed && !signed ? "max-w-[1152px]" : "max-w-[820px]"}
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

/**
 * DocumentSignedConfirmation — the direct-to-documenso post-sign view, rendered IN PLACE within
 * DocumentSignPage's DocumentFrame once the server poll confirms the envelope is signed.
 *
 * Built first-principles for THIS flow: no docraptor/proposal post-sign components, no proposal
 * `ref` (this flow is keyed by the envelope id alone). Deliberately minimal — the operator's bar is
 * "a page LOADS on signing." A clear confirmation headline + one reassurance line, on-theme via the
 * shared surface/accent tokens.
 *
 * PHASE 2b: the payment CTA advances signed → pay. The direct-to-documenso flow keys payment on the
 * `(opportunityId, documentId)` PAIR the signing link already carries (mirroring the route shape
 * `/p/m/:opportunityId/:documentId`), not a proposal `ref`. The "Continue to payment" action below
 * points at `/p/m/:opportunityId/:documentId/pay`.
 */
function DocumentSignedConfirmation({
  opportunityId,
  documentId,
}: {
  opportunityId: string;
  documentId: string;
}) {
  return (
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
      <h2 className="mt-6 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        Agreement signed
      </h2>
      <p className="mt-4 max-w-[440px] font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] leading-relaxed tracking-[0.06em]">
        Your engagement agreement has been signed and recorded. A fully executed copy will be sent
        to your email.
      </p>
      {/* PHASE 2b — payment handoff, keyed by the (opportunityId, documentId) pair. */}
      <Link
        to={`/p/m/${opportunityId}/${documentId}/pay`}
        className="mt-8 inline-block border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-3 font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
      >
        Continue to payment →
      </Link>
    </div>
  );
}
