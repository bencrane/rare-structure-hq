/**
 * OperatorProposalDraft — the operator's view of the proposal at `/p/:ref` (signed in to their own
 * account). The prospect sees the final, read-only summary; the operator sees THIS — the same page,
 * but it's "their version," quietly editable.
 *
 * It does not look like a draft. By default everything renders final. Only when the operator clicks
 * the lock in the header do the term values (fee, quarterly, success tiers) become editable. At the
 * execution block the operator signs in the moment (draws a signature) rather than showing a
 * pre-typed mark, then Confirms — which (eventually) renders via DocRaptor → Documenso and, when the
 * sealed PDF is ready, flips a subtle indicator so the link can be shared on the call.
 *
 * PROTOTYPE: edits + signature + lifecycle are local (see useProposalDraft); nothing is pushed to
 * the backend or auto-sent. Confirm simulates the render round-trip.
 */
import type { ProposalShell } from "@rare-structure-hq/shared";
import { Check, Copy, ExternalLink, Lock, LockOpen, PenLine } from "lucide-react";
import { useState } from "react";

import { ProposalViewerShell } from "@/proposals/ProposalViewerShell";
import { SignatureOverlay } from "@/proposals/SignaturePad";
import { type DraftStatus, useProposalDraft } from "@/proposals/useProposalDraft";

export function OperatorProposalDraft({
  shell,
  proposalRef,
}: {
  shell: ProposalShell;
  proposalRef: string;
}) {
  const { draft, setOverride, setSignature, clearSignature, submit } =
    useProposalDraft(proposalRef);
  const [editing, setEditing] = useState(false);
  const [signing, setSigning] = useState(false);

  const finalized = draft.status !== "draft"; // submitted / ready → locked in
  const signed = !!draft.signature;
  // Terms are only editable before signing — a signature binds the terms shown (re-sign to edit).
  const canEditValues = !finalized && editing && !signed;

  return (
    <ProposalViewerShell
      title="Engagement Proposal"
      proposalRef={proposalRef}
      clientName={shell.client.name}
      maxWidthClass="max-w-[820px]"
      headerAccessory={
        <DraftControls
          status={draft.status}
          editing={editing}
          signed={signed}
          onToggle={() => setEditing((e) => !e)}
        />
      }
    >
      <div className="px-6 py-10 md:px-10 md:py-12">
        {/* Edit-mode hint — the only "draft" tell, and only while editing. */}
        {canEditValues && (
          <div className="mb-6 flex items-center gap-2 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-3 py-2 font-mono text-[0.5625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em]">
            <LockOpen className="size-3" />
            Editing terms — click the lock to finish
          </div>
        )}

        {/* Prepared for */}
        <div className="mb-6 border-[color:var(--color-border-subtle)] border-b pb-4">
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
        </div>

        {/* Exec summary */}
        <p className="mb-8 text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.6]">
          {shell.execSummary}
        </p>

        {/* Headline terms — editable when unlocked */}
        <div className="mb-10">
          <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            {shell.templateLabel}
          </div>
          <div>
            {shell.headline.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-3"
              >
                <span className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
                  {row.label}
                </span>
                {canEditValues ? (
                  <input
                    value={draft.overrides[row.label] ?? row.value}
                    onChange={(e) => setOverride(row.label, e.target.value)}
                    className="w-[12rem] border-[color:var(--color-border-default)] border-b bg-transparent py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums outline-none focus:border-[color:var(--color-text-accent)]"
                  />
                ) : (
                  <span className="text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums">
                    {draft.overrides[row.label] ?? row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Execution — capital partner placeholder + the operator's live signature */}
        <ExecutionBlock
          shell={shell}
          signature={draft.signature}
          signedAt={draft.signedAt}
          finalized={finalized}
          onSign={() => setSigning(true)}
          onClearSignature={clearSignature}
        />

        {/* Action — confirm → render → ready */}
        <DraftActionBar
          status={draft.status}
          hasSignature={!!draft.signature}
          proposalRef={proposalRef}
          onSubmit={submit}
        />

        <div className="mt-10 text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          {proposalRef} · Confidential · Originated by Rare Structure LLC
        </div>
      </div>

      {signing && (
        <SignatureOverlay
          onApply={(dataUrl) => {
            setSignature(dataUrl);
            setSigning(false);
          }}
          onCancel={() => setSigning(false)}
        />
      )}
    </ProposalViewerShell>
  );
}

// Header control — the only edit entry. Locked by default (looks final); the lifecycle indicator
// takes over once confirmed.
function DraftControls({
  status,
  editing,
  signed,
  onToggle,
}: {
  status: DraftStatus;
  editing: boolean;
  signed: boolean;
  onToggle: () => void;
}) {
  if (status !== "draft") return <LifecycleIndicator status={status} />;
  // Once signed, the terms are locked to what was signed — re-sign (in the execution block) to edit.
  if (signed)
    return (
      <span className="flex shrink-0 items-center gap-1.5 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-2.5 py-1 font-mono text-[0.5rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em]">
        <Check className="size-3" />
        Signed
      </span>
    );
  return (
    <button
      type="button"
      onClick={onToggle}
      title={editing ? "Lock the terms" : "Unlock to edit the terms"}
      className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] transition-colors ${
        editing
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-accent)]"
      }`}
    >
      {editing ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
      {editing ? "Editing" : "Edit"}
    </button>
  );
}

// Post-confirm indicator — "ever so subtly" changes color when the sealed PDF is ready to share.
function LifecycleIndicator({ status }: { status: DraftStatus }) {
  const ready = status === "ready";
  return (
    <span
      title={ready ? "Sealed PDF ready to share" : "Rendering the agreement…"}
      className="flex shrink-0 items-center gap-1.5 border border-[color:var(--color-border-default)] px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
    >
      <span
        className={`size-1.5 rounded-full ${
          ready
            ? "bg-[color:var(--color-state-success)]"
            : "animate-pulse bg-[color:var(--color-text-subtle)]"
        }`}
      />
      {ready ? "Ready" : "Rendering"}
    </span>
  );
}

function ExecutionBlock({
  shell,
  signature,
  signedAt,
  finalized,
  onSign,
  onClearSignature,
}: {
  shell: ProposalShell;
  signature: string | null;
  signedAt: string | null;
  finalized: boolean;
  onSign: () => void;
  onClearSignature: () => void;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        Execution
      </div>
      <p className="mb-5 text-[0.8125rem] text-[color:var(--color-text-muted)] leading-[1.55]">
        {finalized
          ? "Your version is locked and rendering. Share the link once the sealed PDF is ready."
          : "This is your version of the mandate. Adjust the terms if needed, then sign and confirm."}
      </p>

      <div className="border border-[color:var(--color-border-subtle)] p-6">
        {/* Capital Partner — awaits the prospect */}
        <div className="mb-2.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Capital Partner Signature
        </div>
        <div className="flex h-[84px] items-center justify-center border border-[color:var(--color-border-default)] font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Awaiting capital partner
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

        {/* Originator — the operator signs in the moment */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
            Originator Signature
          </span>
          {signature && !finalized && (
            <button
              type="button"
              onClick={onClearSignature}
              className="font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]"
            >
              Re-sign
            </button>
          )}
        </div>
        {signature ? (
          <div className="flex h-[84px] items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)]">
            <img src={signature} alt="Originator signature" className="max-h-[72px] w-auto" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onSign}
            disabled={finalized}
            className="flex h-[84px] w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
          >
            <PenLine className="size-4" />
            Sign the mandate
          </button>
        )}
        <div className="mt-3 text-[0.875rem] text-[color:var(--color-text-primary)]">
          Rare Structure LLC
        </div>
        <div className="text-[0.75rem] text-[color:var(--color-text-muted)]">
          Catalyst Origination Desk
          {signedAt ? ` · ${formatDate(signedAt)}` : ""}
        </div>
      </div>
    </div>
  );
}

function DraftActionBar({
  status,
  hasSignature,
  proposalRef,
  onSubmit,
}: {
  status: DraftStatus;
  hasSignature: boolean;
  proposalRef: string;
  onSubmit: () => void;
}) {
  if (status === "draft") {
    return (
      <div className="mt-8">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasSignature}
          className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 text-center font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
        >
          Confirm &amp; originate
        </button>
        <p className="mt-2 text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          {hasSignature
            ? "Locks the terms + signature and renders the agreement. You share the link yourself."
            : "Sign the mandate to confirm"}
        </p>
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] py-4 font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em]">
        <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--color-text-subtle)]" />
        Rendering the agreement…
      </div>
    );
  }

  return <ReadyBar proposalRef={proposalRef} />;
}

function ReadyBar({ proposalRef }: { proposalRef: string }) {
  const url = `${window.location.origin}/p/${proposalRef}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure origin / denied) — the link stays visible to copy by hand.
    }
  }

  return (
    <div className="mt-8 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <span className="size-1.5 rounded-full bg-[color:var(--color-state-success)]" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">Agreement ready</span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
        The sealed PDF is generated. Share the link on the call, or send it yourself when you're
        ready to close.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={`/p/${proposalRef}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          <ExternalLink className="size-3.5" />
          Open as client
        </a>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
