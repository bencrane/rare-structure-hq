/**
 * SignPage — the signing view at `/p/:ref/sign`.
 *
 * Houses the Documenso embed in the shared `ProposalViewerShell`, so the signing surface reads as
 * a seamless continuation of the executive summary (`/p/:ref`) — same utility bar, framed card,
 * letterhead header, and trust-strip footer. The embed (Platform-themed via `cssVars`/`css`) is the
 * two-column signing surface; on completion we route back to the summary, which shows the executed
 * state.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import { useNavigate, useParams } from "react-router-dom";

import { ProposalViewerShell } from "@/proposals/ProposalViewerShell";
import { getProposalShell } from "@/proposals/api";
import {
  DOCUMENSO_CSS_VARS,
  DOCUMENSO_DEFAULT_HOST,
  DOCUMENSO_EMBED_CSS,
} from "@/proposals/documensoTheme";
import { useProposalShell } from "@/proposals/useProposalShell";

export default function SignPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { shell, state } = useProposalShell(ref, getProposalShell);

  let body: React.ReactNode;
  if (state === "loading") {
    body = <BodyNote>Preparing the agreement…</BodyNote>;
  } else if (state === "notfound" || !shell || !ref) {
    body = <BodyNote>This proposal link is invalid or has expired.</BodyNote>;
  } else if (!shell.signingToken) {
    body = <BodyNote>Document is being prepared — check back in a moment.</BodyNote>;
  } else {
    body = (
      <EmbedSignDocument
        token={shell.signingToken}
        host={shell.documensoHost ?? DOCUMENSO_DEFAULT_HOST}
        darkModeDisabled={false}
        cssVars={DOCUMENSO_CSS_VARS}
        css={DOCUMENSO_EMBED_CSS}
        className="h-full min-h-[78vh] w-full border-0"
        onDocumentCompleted={() => navigate(`/p/${ref}`, { state: { justSigned: true } })}
        onDocumentError={(e) => console.error("documenso sign error", e)}
      />
    );
  }

  return (
    <ProposalViewerShell
      title="Engagement Agreement"
      proposalRef={ref}
      clientName={shell?.client.name}
      status={shell?.status}
      backHref={ref ? `/p/${ref}` : "/"}
      maxWidthClass="max-w-[1152px]"
    >
      {body}
    </ProposalViewerShell>
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
