/**
 * ProposalShell — the client-facing capability page at `/p/:ref`.
 *
 * A deliberately LEAN surface, distinct from the legacy `/proposal/:ref` page
 * (which stays as-is). Two artifacts are decoupled: this shell is the
 * conversion veneer — exec summary + headline terms a client groks at a glance,
 * then the embedded signing ceremony — while the FULL legal instrument is the
 * Anvil document itself (signed in the iframe, delivered as the executed copy).
 * No catalyst/leverage sidebar; the headline numbers are snapshotted server-side
 * so they always match what is bound into the cast.
 */
import AnvilEmbedFrame from "@anvilco/anvil-embed-frame";
import type { ProposalShell } from "@rare-structure-hq/shared";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getProposalShell, startSignSession } from "@/proposals/api";

export default function ProposalShellPage() {
  const { ref } = useParams<{ ref: string }>();
  const [shell, setShell] = useState<ProposalShell | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    if (!ref) {
      setState("notfound");
      return;
    }
    let active = true;
    setState("loading");
    getProposalShell(ref)
      .then((s) => {
        if (!active) return;
        if (!s) {
          setState("notfound");
        } else {
          setShell(s);
          setState("ready");
        }
      })
      .catch(() => active && setState("notfound"));
    return () => {
      active = false;
    };
  }, [ref]);

  if (state === "loading") return <CenterNote>Loading proposal…</CenterNote>;
  if (state === "notfound" || !shell || !ref) return <NotFound />;
  return <Shell shell={shell} proposalRef={ref} />;
}

function Shell({ shell, proposalRef }: { shell: ProposalShell; proposalRef: string }) {
  const reduced = !!useReducedMotion();
  const [signed, setSigned] = useState(shell.status === "signed" || shell.status === "paid");
  const enter = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <div className="mx-auto w-full max-w-[620px] px-6 py-[12vh]">
        {/* Letterhead */}
        <motion.div {...enter(0.05)} className="mb-8 flex items-start justify-between">
          <div>
            <div className="font-display font-semibold text-[0.9375rem] text-[color:var(--color-text-primary)] uppercase tracking-[0.18em]">
              Rare Structure
            </div>
            <div className="mt-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Catalyst-Driven Origination
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em]">
              Engagement Proposal
            </div>
            <div className="mt-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] tracking-[0.1em]">
              {proposalRef}
            </div>
          </div>
        </motion.div>

        {/* Prepared for */}
        <motion.div
          {...enter(0.12)}
          className="mb-6 border-[color:var(--color-border-subtle)] border-y py-4"
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
          {...enter(0.18)}
          className="mb-8 text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.6]"
        >
          {shell.execSummary}
        </motion.p>

        {/* Headline terms — grok at a glance */}
        <motion.div {...enter(0.24)} className="mb-10">
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
            <motion.div key="sign" {...enter(0.3)}>
              <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
                Execution
              </div>
              <p className="mb-4 text-[0.8125rem] text-[color:var(--color-text-muted)] leading-[1.55]">
                The full engagement agreement is prepared for your signature. Review and sign below
                — a countersigned copy is sent to you on completion.
              </p>
              <SignSection proposalRef={proposalRef} onSigned={() => setSigned(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          {proposalRef} · Confidential · Originated by Rare Structure LLC
        </div>
      </div>
    </div>
  );
}

// "Review & sign" → mint a fresh embedded sign URL → hand off to the Anvil
// iframe. The cast's full text IS the legal instrument; `signerComplete`
// advances to the executed state.
function SignSection({ proposalRef, onSigned }: { proposalRef: string; onSigned: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStatus("loading");
    setError(null);
    try {
      setUrl(await startSignSession(proposalRef));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start signing");
      setStatus("error");
    }
  }

  if (url) {
    return (
      <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)]">
        <AnvilEmbedFrame
          iframeURL={url}
          scroll="auto"
          onEvent={(event: { action?: string }) => {
            if (event?.action === "signerComplete") onSigned();
          }}
          className="w-full"
          style={{ border: "none", width: "100%", minHeight: 680 }}
        />
        <div className="border-[color:var(--color-border-subtle)] border-t px-4 py-3 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Secured by Anvil · Legally binding e-signature
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={status === "loading"}
        className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-4 text-center font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
      >
        {status === "loading" ? "Preparing document…" : "Review & sign agreement"}
      </button>
      {error && (
        <div className="mt-2 font-mono text-[0.625rem] text-[color:var(--color-state-warn)]">
          {error}
        </div>
      )}
    </div>
  );
}

// Executed — signed by the client. The Stripe ACH payment handoff is grafted in
// Phase 5; for now this is the terminal confirmation.
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
        Thank you, {client}. A countersigned copy is on its way to you. Payment instructions follow
        to activate the engagement.
      </p>
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
