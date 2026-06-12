/**
 * MandateSignPage — the prospect's direct-to-documenso signing view at `/p/m/:envelopeId`.
 *
 * The direct-to-documenso counterpart to `SignPage`. The operator's "Confirm & originate"
 * instantiates a Documenso document from the engagement template and shares this link (the envelope
 * id is its own credential). The prospect lands on the mandate framing, clicks "Proceed to
 * proposal", and the token-driven Documenso embed reveals — the SAME `EmbedSignDocument`, theme, and
 * `DocumentFrame` chrome the proposal flow uses, so the two origination modes read identically to
 * the prospect.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
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

  let body: React.ReactNode;
  if (state === "loading") {
    body = <BodyNote>Preparing the agreement…</BodyNote>;
  } else if (state === "notfound" || !doc) {
    body = <BodyNote>This mandate link is invalid or has expired.</BodyNote>;
  } else if (!doc.signingToken) {
    body = <BodyNote>Document is being prepared — check back in a moment.</BodyNote>;
  } else if (!proceed) {
    body = <ProceedGate onProceed={() => setProceed(true)} />;
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
    <DocumentFrame title="Engagement Agreement" backHref="/" maxWidthClass="max-w-[1152px]">
      {body}
    </DocumentFrame>
  );
}

// The "mandate page → proceed to proposal" gate: the prospect arrives here, then reveals the embed.
// Geometry (gap/padding) is held on the inner wrapper, not the top-level JSX — the route owns its
// own outer geometry (no-route-geometry), mirroring BodyNote.
function ProceedGate({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-center">
      <div className="flex max-w-[460px] flex-col items-center gap-6 px-6">
        <p className="text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.6]">
          Your engagement agreement is ready for signature.
        </p>
        <button
          type="button"
          onClick={onProceed}
          className="border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-8 py-3 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
        >
          Proceed to proposal →
        </button>
      </div>
    </div>
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
