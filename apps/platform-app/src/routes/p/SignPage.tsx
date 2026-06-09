/**
 * SignPage — the full-page signing view at `/p/:ref/sign`.
 *
 * Renders the Documenso embed at full width: its native two-column layout (the signing widget on
 * the left, the dark on-brand agreement PDF on the right) — all on our own domain. Signing once
 * applies the signature across the document and Documenso seals it. On completion we route back to
 * the executive summary, which then shows the executed state.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getProposalShell } from "@/proposals/api";
import { DOCUMENSO_CSS_VARS, DOCUMENSO_DEFAULT_HOST } from "@/proposals/documensoTheme";
import { useProposalShell } from "@/proposals/useProposalShell";

export default function SignPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { shell, state } = useProposalShell(ref, getProposalShell);

  if (state === "loading") return <Center>Loading…</Center>;
  if (state === "notfound" || !shell || !ref) {
    return <Center>This proposal link is invalid or has expired.</Center>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-surface-base)]">
      <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-6 py-4">
        <Link
          to={`/p/${ref}`}
          className="font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.16em] transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          ← Back to summary
        </Link>
        <div className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Rare Structure · Strategic Origination Mandate
        </div>
      </div>

      <div className="relative flex-1">
        {shell.signingToken ? (
          <EmbedSignDocument
            token={shell.signingToken}
            host={shell.documensoHost ?? DOCUMENSO_DEFAULT_HOST}
            darkModeDisabled={false}
            cssVars={DOCUMENSO_CSS_VARS}
            className="h-full min-h-[80vh] w-full border-0"
            onDocumentCompleted={() => navigate(`/p/${ref}`, { state: { justSigned: true } })}
            onDocumentError={(e) => console.error("documenso sign error", e)}
          />
        ) : (
          <Center>Document is being prepared — check back in a moment.</Center>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-surface-base)] px-6 text-center">
      <div className="max-w-[420px] font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.18em]">
        {children}
      </div>
    </div>
  );
}
