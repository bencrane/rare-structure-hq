/**
 * MandateSignPage — the prospect's direct-to-documenso signing view at `/p/m/:envelopeId`.
 *
 * The direct-to-documenso counterpart to `SignPage`. The operator's "Confirm & originate"
 * instantiates a Documenso document from the engagement template and shares this link (the envelope
 * id is its own credential). The prospect lands on the SAME engagement-proposal scaffold the operator
 * sees (`MandateProposalScaffold`) — except the Execution box, instead of a signature pad, shows
 * "Proceed to Proposal"; clicking it reveals the token-driven Documenso embed (the actual agreement),
 * reusing the same theme + `DocumentFrame` chrome the proposal flow uses.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { MandateProposalScaffold } from "@/proposals/MandateProposalScaffold";
import { type MandateDraftDocument, getMandateDraftDocument } from "@/proposals/api";
import {
  DOCUMENSO_CSS_VARS,
  DOCUMENSO_DEFAULT_HOST,
  DOCUMENSO_EMBED_CSS,
} from "@/proposals/documensoTheme";

type LoadState = "loading" | "ready" | "notfound";

export default function MandateSignPage() {
  const { envelopeId } = useParams<{ envelopeId: string }>();
  const [doc, setDoc] = useState<MandateDraftDocument | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [proceed, setProceed] = useState(false);

  useEffect(() => {
    if (!envelopeId) {
      setState("notfound");
      return;
    }
    let active = true;
    getMandateDraftDocument(envelopeId)
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
  }, [envelopeId]);

  // The embed (the actual agreement) takes over only after the prospect proceeds; until then the page
  // mirrors the operator's mandate scaffold. The embed needs a wide two-column frame; the scaffold a
  // narrow reading column.
  const showingEmbed = state === "ready" && !!doc?.signingToken && proceed;

  let body: React.ReactNode;
  if (state === "loading") {
    body = <BodyNote>Preparing the agreement…</BodyNote>;
  } else if (state === "notfound" || !doc) {
    body = <BodyNote>This mandate link is invalid or has expired.</BodyNote>;
  } else if (!doc.signingToken) {
    body = <BodyNote>Document is being prepared — check back in a moment.</BodyNote>;
  } else if (!proceed) {
    // Mirror the operator's mandate scaffold; the Execution box carries the prospect's CTA in place
    // of the signature pad. Content values are placeholders pending the draft-data wiring.
    body = (
      <MandateProposalScaffold
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
    body = (
      <EmbedSignDocument
        token={doc.signingToken}
        host={doc.documensoHost ?? DOCUMENSO_DEFAULT_HOST}
        darkModeDisabled={false}
        cssVars={DOCUMENSO_CSS_VARS}
        css={DOCUMENSO_EMBED_CSS}
        className="h-full min-h-[78vh] w-full border-0"
        onDocumentError={(e) => console.error("documenso sign error", e)}
      />
    );
  }

  // `status` is intentionally not forwarded: DocumentFrame's status pill speaks the proposal
  // lifecycle vocabulary (created/sent/signed/paid), whereas a draft carries Documenso's envelope
  // status (PENDING/COMPLETED) — a different vocabulary. The draft surface shows no lifecycle pill.
  return (
    <DocumentFrame
      title={showingEmbed ? "Engagement Agreement" : "Engagement Proposal"}
      backHref="/"
      maxWidthClass={showingEmbed ? "max-w-[1152px]" : "max-w-[820px]"}
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
