/**
 * SignPage — the signing view at `/p/:ref/sign`.
 *
 * Presents the Documenso embed inside a production-grade PROPOSAL VIEWER shell that reads as a
 * continuation of the executive summary (`/p/:ref`): the same dark identity, mono letterhead, and
 * sharp-edged framing. The embed (Platform-themed via `cssVars`/`css`) is the signing surface — its
 * two-column layout (sign widget + the on-brand agreement) sits framed inside our viewer rather
 * than sprawling full-bleed. Signing once seals the document; on completion we route back to the
 * summary, which then shows the executed state.
 */
import { EmbedSignDocument } from "@documenso/embed-react";
import type { ProposalShell } from "@rare-structure-hq/shared";
import { Link, useNavigate, useParams } from "react-router-dom";

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
    <div className="flex min-h-screen flex-col bg-[color:var(--color-surface-base)]">
      {/* Utility bar — app chrome */}
      <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-6 py-4">
        <Link
          to={ref ? `/p/${ref}` : "/"}
          className="font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.16em] transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          ← Back to summary
        </Link>
        <div className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Rare Structure · Strategic Origination Mandate
        </div>
      </div>

      {/* Proposal viewer — framed, centered, on-brand */}
      <div className="flex flex-1 justify-center px-4 py-6 md:px-8 md:py-10">
        <div className="flex w-full max-w-[1152px] flex-col overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] shadow-[0_24px_64px_-32px_rgba(0,0,0,0.8)]">
          {/* Viewer header — document identity (letterhead-grade) */}
          <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-raised)] px-6 py-4">
            <div className="min-w-0">
              <div className="font-display font-semibold text-[0.8125rem] text-[color:var(--color-text-primary)] uppercase tracking-[0.16em]">
                Engagement Agreement
              </div>
              <div className="mt-1 truncate font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
                {shell?.client.name
                  ? `Prepared for ${shell.client.name}`
                  : "Strategic Origination Mandate"}
                {ref ? ` · ${ref}` : ""}
              </div>
            </div>
            <StatusPill status={shell?.status} />
          </div>

          {/* Body — the signing surface */}
          <div className="relative flex-1 bg-[color:var(--color-surface-base)]">{body}</div>

          {/* Viewer footer — trust strip (mirrors the exec-summary execution panel) */}
          <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-raised)] px-6 py-3">
            <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Secured by Documenso · Legally binding e-signature
            </span>
            <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Audit trail preserved
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small mono status chip — mirrors the proposal lifecycle on the viewer header.
function StatusPill({ status }: { status?: ProposalShell["status"] }) {
  const executed = status === "signed" || status === "paid";
  const label =
    status === "paid" ? "Executed" : status === "signed" ? "Signed" : "Awaiting signature";
  const tone = executed
    ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
    : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)]";
  return (
    <span
      className={`shrink-0 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] ${tone}`}
    >
      {label}
    </span>
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
