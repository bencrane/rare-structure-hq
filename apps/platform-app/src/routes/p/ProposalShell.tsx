/**
 * ProposalShell — the client-facing executive summary at `/p/:ref`.
 *
 * A lean conversion surface housed in the shared `ProposalViewerShell` so it reads as one
 * continuous experience with the signing view (`/p/:ref/sign`): same utility bar, framed card,
 * letterhead header, and trust-strip footer. The body carries the exec summary, headline terms,
 * and a native EXECUTION panel — the pre-signed Rare Structure originator block beside a "PROCEED
 * TO PROPOSAL" CTA that routes into the signing view. The agreement PDF never appears here.
 */
import type { ProposalShell } from "@rare-structure-hq/shared";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { OperatorProposalDraft } from "@/proposals/OperatorProposalDraft";
import { ProposalViewerShell } from "@/proposals/ProposalViewerShell";
import { getProposalShell } from "@/proposals/api";
import { useProposalShell } from "@/proposals/useProposalShell";

export default function ProposalShellPage() {
  const { ref } = useParams<{ ref: string }>();
  const location = useLocation();
  const justSigned = (location.state as { justSigned?: boolean } | null)?.justSigned === true;
  const { shell, state } = useProposalShell(ref, getProposalShell);
  const { isOperator, loading: authLoading } = useAuth();

  // Wait for BOTH the shell and the auth session before deciding operator vs prospect — otherwise
  // an operator (session hydrates a tick late) flashes the prospect view first.
  if (state === "loading" || authLoading) return <CenterNote>Loading proposal…</CenterNote>;
  if (state === "notfound" || !shell || !ref) return <NotFound />;
  // Signed-in operator → their editable "draft" version. Prospects see the read-only summary.
  // `key={ref}` forces a fresh draft when navigating operator-side between proposals.
  if (isOperator) return <OperatorProposalDraft key={ref} shell={shell} proposalRef={ref} />;
  return <Shell shell={shell} proposalRef={ref} initialSigned={justSigned} />;
}

function Shell({
  shell,
  proposalRef,
  initialSigned,
}: {
  shell: ProposalShell;
  proposalRef: string;
  initialSigned: boolean;
}) {
  const reduced = !!useReducedMotion();
  const [signed] = useState(initialSigned || shell.status === "signed" || shell.status === "paid");
  const enter = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <ProposalViewerShell
      title="Engagement Proposal"
      status={shell.status}
      maxWidthClass="max-w-[820px]"
    >
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        {/* Prepared for */}
        <motion.div
          {...enter(0.05)}
          className="mb-6 border-[color:var(--color-border-subtle)] border-b pb-4"
        >
          <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
            Prepared for
          </div>
          <div className="text-[0.9375rem] text-[color:var(--color-text-primary)]">
            {shell.client.name}
          </div>
          {shell.client.title && (
            <div className="text-[0.8125rem] text-[color:var(--color-text-muted)]">
              {shell.client.title}
            </div>
          )}
        </motion.div>

        {/* Exec summary */}
        <motion.p
          {...enter(0.12)}
          className="mb-8 text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.6]"
        >
          {shell.execSummary}
        </motion.p>

        {/* Headline terms — grok at a glance */}
        <motion.div {...enter(0.18)} className="mb-10">
          <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            {shell.templateLabel}
          </div>
          <div>
            {shell.headline.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between border-[color:var(--color-border-subtle)] border-b py-3"
              >
                <span className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
                  {row.label}
                </span>
                <span className="text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Execution */}
        <AnimatePresence mode="wait">
          {signed ? (
            <ExecutedPanel key="executed" proposalRef={proposalRef} client={shell.client.name} />
          ) : (
            <motion.div key="exec" {...enter(0.24)}>
              <ExecutionPanel shell={shell} proposalRef={proposalRef} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          {proposalRef} · Confidential · Originated by Rare Structure LLC
        </div>
      </div>
    </ProposalViewerShell>
  );
}

// Native execution block — mirrors the legal signature block. The Capital Partner side is a
// "PROCEED TO PROPOSAL" CTA that routes to the signing view; the Originator side is the pre-signed
// Rare Structure mark. No PDF on this page.
function ExecutionPanel({ shell, proposalRef }: { shell: ProposalShell; proposalRef: string }) {
  const ready = !!shell.signingToken;
  return (
    <div>
      <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        Execution
      </div>
      <p className="mb-5 text-[0.8125rem] text-[color:var(--color-text-muted)] leading-[1.55]">
        The full engagement agreement is prepared for your signature. Proceed to review and execute
        — a countersigned copy is sent to you on completion.
      </p>

      <div className="border border-[color:var(--color-border-subtle)] p-6">
        {/* Capital Partner — the CTA */}
        <div className="mb-2.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Signature
        </div>
        <div className="flex items-end gap-5">
          {ready ? (
            <Link
              to={`/p/${proposalRef}/sign`}
              className="flex h-[84px] flex-1 items-center justify-center border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
            >
              Proceed to Proposal
            </Link>
          ) : (
            <div className="flex h-[84px] flex-1 items-center justify-center border border-[color:var(--color-border-default)] font-mono text-[0.6875rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Preparing document…
            </div>
          )}
          <DateStub label="Date" value="—" />
        </div>
        <div className="mt-3 text-[0.875rem] text-[color:var(--color-text-primary)]">
          {shell.client.name}
        </div>
        {shell.client.title && (
          <div className="text-[0.75rem] text-[color:var(--color-text-muted)]">
            {shell.client.title}
          </div>
        )}

        <div className="my-6 border-[color:var(--color-border-subtle)] border-t" />

        {/* Originator — pre-signed */}
        <div className="mb-2.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Signature
        </div>
        <div className="flex items-end gap-5">
          <div className="flex h-[84px] flex-1 items-center justify-center bg-[color:var(--color-surface-raised)] font-mono text-[1.0625rem] text-[color:var(--color-text-primary)] italic tracking-[0.04em]">
            Rare Structure LLC
          </div>
          <DateStub label="Date" value={formatDate(shell.effectiveDate)} />
        </div>
        <div className="mt-3 text-[0.875rem] text-[color:var(--color-text-primary)]">
          Rare Structure LLC
        </div>
      </div>
    </div>
  );
}

function DateStub({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col">
      <div className="mb-1 font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
        {label}
      </div>
      <div className="border-[color:var(--color-border-subtle)] border-b pb-1 text-[0.8125rem] text-[color:var(--color-text-muted)] tabular-nums">
        {value || "—"}
      </div>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Executed — signed by the client. The Stripe ACH payment handoff is grafted in Phase 5; for now
// this is the terminal confirmation.
function ExecutedPanel({ proposalRef, client }: { proposalRef: string; client: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-8 text-center"
    >
      <div className="mx-auto mb-4 flex size-11 items-center justify-center border border-[color:var(--color-text-accent)] text-[color:var(--color-text-accent)]">
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div className="font-display font-semibold text-[1.125rem] text-[color:var(--color-text-primary)]">
        Agreement executed
      </div>
      <p className="mt-2 text-[0.875rem] text-[color:var(--color-text-muted)] leading-[1.55]">
        Thank you, {client}. A countersigned copy is on its way to you. Continue to payment to
        activate the engagement.
      </p>
      <Link
        to={`/p/${proposalRef}/pay`}
        className="mt-5 inline-block border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-3 font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
      >
        Continue to payment →
      </Link>
      <div className="mt-5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
        {proposalRef} · Executed
      </div>
    </motion.div>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-surface-base)]">
      <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.2em]">
        {children}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--color-surface-base)]">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="font-display font-semibold text-[0.9375rem] text-[color:var(--color-text-primary)] uppercase tracking-[0.18em]">
          Rare Structure
        </div>
        <p className="max-w-[420px] text-[0.8125rem] text-[color:var(--color-text-muted)] leading-relaxed">
          This proposal link is invalid or has expired. Check the link in your engagement email, or
          contact the origination desk.
        </p>
      </div>
    </div>
  );
}
