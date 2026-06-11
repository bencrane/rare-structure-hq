/**
 * MandateEditor — the operator's mandate-generator/editor at `/app/m/:ref`.
 *
 * By default everything renders final. Clicking the header lock makes the STRUCTURED terms editable
 * (monthly fee, term, billing cadence, success-fee tiers — see `PricingEditor`). At the execution
 * block the operator signs in the moment (a cosmetic on-page gate — it binds nothing; the real
 * originator counter-signature is Documenso's), which unlocks "Confirm & originate".
 *
 * Confirm is the REAL originate (see useProposalDraft.submit → confirmProposal): it STAMPS the
 * locked-in values onto the proposal instance (BFF → edge_api), which renders the PDF from them +
 * creates the Documenso envelope, then reveals the share link (`ReadyBar` → `/p/:ref`). "Ready" is
 * driven by the actual provisioning result, so the prospect's "Proceed to Proposal" goes live with
 * it. Edits + signature survive a reload via localStorage; the lifecycle is re-derived from the shell.
 */
import type { BillingCadence, ProposalPricing, ProposalShell } from "@rare-structure-hq/shared";
import { Check, Copy, ExternalLink, Lock, LockOpen, PenLine } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";
import { SignatureOverlay } from "@/proposals/SignaturePad";
import { type DraftStatus, useProposalDraft } from "@/proposals/useProposalDraft";

// Defensive only — the BFF shell always carries `pricing` now; this keeps types total if an older
// engine response omits it (the editor then just seeds zeros, never crashes).
const FALLBACK_PRICING: ProposalPricing = {
  monthlyFeeCents: 0,
  durationMonths: 6,
  billingCadence: "upfront_in_full",
  successFeeTiers: [],
};

const CADENCE_OPTIONS: { value: BillingCadence; label: string }[] = [
  { value: "upfront_in_full", label: "Upfront, in full" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

function formatUsd(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function cadenceLabel(c: string): string {
  return CADENCE_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

export function MandateEditor({
  shell,
  proposalRef,
  housing = "standalone",
}: {
  shell: ProposalShell;
  proposalRef: string;
  /** Forwarded to DocumentFrame. `"cockpit"` only when mounted in the Mandate page. */
  housing?: "standalone" | "cockpit";
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const { draft, setPricing, setSignature, clearSignature, submit } = useProposalDraft(
    proposalRef,
    {
      pricing: shell.pricing ?? FALLBACK_PRICING,
      // Already-originated proposals (an envelope exists) open terminal — no re-edit / re-confirm.
      originated: shell.status !== "created",
    },
  );
  const [editing, setEditing] = useState(false);
  const [signing, setSigning] = useState(false);

  const finalized = draft.status === "submitting" || draft.status === "ready"; // locked in
  const signed = !!draft.signature;
  // Terms are only editable before signing — a signature binds the terms shown (re-sign to edit).
  const canEditValues = !finalized && editing && !signed;

  return (
    <DocumentFrame
      title="Engagement Proposal"
      maxWidthClass="max-w-[820px]"
      housing={housing}
      headerAccessory={
        <DraftControls
          status={draft.status}
          editing={editing}
          signed={signed}
          onToggle={() => setEditing((e) => !e)}
        />
      }
    >
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
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

        {/* Headline terms — STRUCTURED, editable when unlocked. These are the dynamic values that
            get stamped onto the instance + rendered into the PDF on Confirm. */}
        <PricingEditor
          label={shell.templateLabel}
          pricing={draft.pricing}
          editable={canEditValues}
          onChange={setPricing}
        />

        {/* Execution — the operator's live signature */}
        <ExecutionBlock
          signature={draft.signature}
          signedAt={draft.signedAt}
          finalized={finalized}
          onSign={() => setSigning(true)}
          onClearSignature={clearSignature}
        />

        {/* Action — confirm → stamp + render → ready. Gated on the on-page signature (cosmetic, but
            the operator signs every time). */}
        <DraftActionBar
          status={draft.status}
          hasSignature={!!draft.signature}
          error={draft.error}
          proposalRef={proposalRef}
          onSubmit={() => void submit(token)}
        />
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
    </DocumentFrame>
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
  // Mid-originate / originated → lifecycle pill. Draft + error keep the editable lock (retry-able).
  if (status === "submitting" || status === "ready") return <LifecycleIndicator status={status} />;
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
      aria-label={editing ? "Lock terms" : "Edit terms"}
      className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] transition-colors ${
        editing
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-accent)]"
      }`}
    >
      {editing ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
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
  signature,
  signedAt,
  finalized,
  onSign,
  onClearSignature,
}: {
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
      <div className="border border-[color:var(--color-border-subtle)] p-6">
        {/* Originator — the operator signs in the moment */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
            Signature
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
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="text-[0.875rem] text-[color:var(--color-text-primary)]">
            Rare Structure LLC
          </span>
          {signedAt && (
            <span className="text-[0.75rem] text-[color:var(--color-text-muted)] tabular-nums">
              {formatDate(signedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftActionBar({
  status,
  hasSignature,
  error,
  proposalRef,
  onSubmit,
}: {
  status: DraftStatus;
  hasSignature: boolean;
  error: string | null;
  proposalRef: string;
  onSubmit: () => void;
}) {
  if (status === "ready") return <ReadyBar proposalRef={proposalRef} />;

  if (status === "submitting") {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] py-4 font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em]">
        <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--color-text-subtle)]" />
        Originating — stamping terms &amp; rendering the agreement…
      </div>
    );
  }

  // draft | error — the signature gate stays: Confirm unlocks only after the operator signs.
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onSubmit}
        disabled={!hasSignature}
        className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 text-center font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
      >
        {status === "error" ? "Retry — confirm & originate" : "Confirm & originate"}
      </button>
      {/* Operator-facing instructional copy intentionally omitted — the mandate page is screenshared
          to the prospect on the call, so "you share the link yourself" must not appear. Only the
          (transient) error surfaces. */}
      {error ? (
        <p className="mt-2 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Structured headline-terms editor — the dynamic values stamped onto the instance + rendered into
// the PDF on Confirm. Display mirrors the prospect shell's headline rows; inputs appear when unlocked.
function PricingEditor({
  label,
  pricing,
  editable,
  onChange,
}: {
  label: string;
  pricing: ProposalPricing;
  editable: boolean;
  onChange: (next: (p: ProposalPricing) => ProposalPricing) => void;
}) {
  const total = pricing.monthlyFeeCents * pricing.durationMonths;
  return (
    <div className="mb-10">
      <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        {label}
      </div>
      <div>
        <TermRow label="Infrastructure Fee">
          {editable ? (
            <MoneyInput
              cents={pricing.monthlyFeeCents}
              onChange={(cents) => onChange((p) => ({ ...p, monthlyFeeCents: cents }))}
              suffix="/ month"
            />
          ) : (
            <TermVal>{formatUsd(pricing.monthlyFeeCents)} / month</TermVal>
          )}
        </TermRow>
        <TermRow label="Term">
          {editable ? (
            <span className="flex items-center justify-end gap-1.5">
              <input
                type="number"
                min={1}
                value={pricing.durationMonths}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    durationMonths: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                  }))
                }
                className={NUM_CLS}
              />
              <span className="text-[0.9375rem] text-[color:var(--color-text-muted)]">months</span>
            </span>
          ) : (
            <TermVal>{pricing.durationMonths} months</TermVal>
          )}
        </TermRow>
        <TermRow label="Billing">
          {editable ? (
            <select
              value={pricing.billingCadence}
              onChange={(e) => onChange((p) => ({ ...p, billingCadence: e.target.value }))}
              className={SELECT_CLS}
            >
              {CADENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <TermVal>{cadenceLabel(pricing.billingCadence)}</TermVal>
          )}
        </TermRow>
        <TermRow label="Total">
          <TermVal>{formatUsd(total)}</TermVal>
        </TermRow>
        {pricing.successFeeTiers.map((tier, i) => (
          <TermRow key={tier.tier} label={tier.tier}>
            {editable ? (
              <input
                value={tier.rate}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    successFeeTiers: p.successFeeTiers.map((t, j) =>
                      j === i ? { ...t, rate: e.target.value } : t,
                    ),
                  }))
                }
                className={RATE_CLS}
              />
            ) : (
              <TermVal>{tier.rate}</TermVal>
            )}
          </TermRow>
        ))}
      </div>
    </div>
  );
}

function TermRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-3">
      <span className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
        {label}
      </span>
      {children}
    </div>
  );
}

function TermVal({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums">
      {children}
    </span>
  );
}

function MoneyInput({
  cents,
  onChange,
  suffix,
}: {
  cents: number;
  onChange: (cents: number) => void;
  suffix?: string;
}) {
  const dollars = Math.round(cents / 100);
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="text-[0.9375rem] text-[color:var(--color-text-muted)]">$</span>
      <input
        inputMode="numeric"
        value={dollars.toLocaleString("en-US")}
        onChange={(e) =>
          onChange((Number.parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0) * 100)
        }
        className={NUM_CLS}
      />
      {suffix && (
        <span className="text-[0.9375rem] text-[color:var(--color-text-muted)]">{suffix}</span>
      )}
    </span>
  );
}

const NUM_CLS =
  "w-[7rem] border-[color:var(--color-border-default)] border-b bg-transparent py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums outline-none focus:border-[color:var(--color-text-accent)]";
const SELECT_CLS =
  "border-[color:var(--color-border-default)] border-b bg-[color:var(--color-surface-sunken)] py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-text-accent)]";
const RATE_CLS =
  "w-[5.5rem] border-[color:var(--color-border-default)] border-b bg-transparent py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] tabular-nums outline-none focus:border-[color:var(--color-text-accent)]";

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
