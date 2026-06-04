import AnvilEmbedFrame from "@anvilco/anvil-embed-frame";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { createProposalPacket, getProposal, getProposalSignUrl } from "@/lib/api";
import { PROPOSAL_DEAL, type ProposalDeal } from "./proposal-data";

// The proposal deal is fetched per `:ref` and shared with every sub-view via
// this context — it replaces the old module-level `const d = PROPOSAL_DEAL`,
// since the data is now dynamic rather than a static import.
const DealContext = createContext<ProposalDeal | null>(null);
function useDeal(): ProposalDeal {
  const deal = useContext(DealContext);
  if (!deal) throw new Error("useDeal must be used within a DealContext provider");
  return deal;
}
const enter = (delay = 0) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function Label({ children }: { children: React.ReactNode }) {
  return (
    <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
      {children}
    </dt>
  );
}

function Value({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <dd
      className={`text-[0.8125rem] ${accent ? "text-[color:var(--color-text-accent)]" : "text-[color:var(--color-text-primary)]"}`}
    >
      {children}
    </dd>
  );
}

function SidebarSection({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const reduced = !!useReducedMotion();
  return (
    <motion.div
      className="border-b border-[color:var(--color-border-subtle)] pb-5"
      {...(reduced ? {} : enter(delay))}
    >
      <div className="mb-3 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
        {title}
      </div>
      {children}
    </motion.div>
  );
}

function Sidebar() {
  const d = useDeal();
  return (
    <aside className="flex w-[320px] shrink-0 flex-col space-y-5 overflow-y-auto border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)] p-6 pt-20">
      <SidebarSection title="Proposal" delay={0.1}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Label>Ref</Label>
          <Value>{d.ref}</Value>
          <Label>Date</Label>
          <Value>{d.date}</Value>
          <Label>Prepared for</Label>
          <Value>{d.partner.contact}</Value>
          <Label>Firm</Label>
          <Value>{d.partner.firm}</Value>
        </dl>
      </SidebarSection>

      <SidebarSection title="Catalyst Signal" delay={0.2}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Label>Type</Label>
          <Value accent>{d.catalyst.type}</Value>
          <Label>Source</Label>
          <Value>{d.catalyst.source}</Value>
          <Label>Value</Label>
          <Value>{d.catalyst.value}</Value>
          <Label>Agency</Label>
          <Value>{d.catalyst.agency}</Value>
          <Label>Status</Label>
          <Value>{d.catalyst.status}</Value>
        </dl>
      </SidebarSection>

      <SidebarSection title="Entity Profile" delay={0.3}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Label>Entity</Label>
          <Value>{d.entity.name}</Value>
          <Label>Type</Label>
          <Value>{d.entity.type}</Value>
          <Label>State</Label>
          <Value>{d.entity.state}</Value>
          <Label>NAICS</Label>
          <Value>{d.entity.naics}</Value>
        </dl>
      </SidebarSection>

      <SidebarSection title="Leverage Structure" delay={0.4}>
        <dl className="grid grid-cols-[1fr] gap-y-2">
          <div>
            <Label>UCC Filings ({d.leverage.uccFilings})</Label>
            {d.leverage.uccTypes.map((t) => (
              <div key={t} className="mt-1 text-[0.75rem] text-[color:var(--color-text-muted)]">
                {t}
              </div>
            ))}
          </div>
          <div className="mt-1">
            <Label>SBA History</Label>
            <div className="mt-1 text-[0.75rem] text-[color:var(--color-text-muted)]">
              {d.leverage.sbaHistory}
            </div>
          </div>
        </dl>
      </SidebarSection>

      <SidebarSection title="Thesis Fit" delay={0.5}>
        <div className="mb-2 font-display text-[1rem] font-semibold text-[color:var(--color-text-accent)]">
          {d.thesis.fit}
        </div>
        <p className="text-[0.75rem] leading-[1.5] text-[color:var(--color-text-muted)]">
          {d.thesis.signal}
        </p>
      </SidebarSection>

      <SidebarSection title="Pipeline Attribution" delay={0.6}>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {d.pipeline.sources.map((s) => (
            <span
              key={s}
              className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-2">
          <Label>Match</Label>
          <div className="mt-0.5 text-[0.75rem] text-[color:var(--color-text-accent)]">
            {d.pipeline.matchTier}
          </div>
        </div>
      </SidebarSection>
    </aside>
  );
}

function SigningEmbed({ onSigned }: { onSigned: () => void }) {
  const d = useDeal();
  const [signURL, setSignURL] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // "Click to sign" → create the embedded Etch packet and mint the one-time
  // sign URL on the BFF, then hand off to the Anvil iframe. The Anvil API key
  // never reaches the browser — only the signerEid and short-lived URL do.
  async function startSigning() {
    setStatus("loading");
    setError(null);
    try {
      const { signerEid } = await createProposalPacket(d.ref, {
        signerName: d.partner.contact,
        signerTitle: d.partner.title,
      });
      const url = await getProposalSignUrl(d.ref, signerEid);
      setSignURL(url);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start signing");
      setStatus("error");
    }
  }

  // Once the embedded URL exists, the Anvil iframe IS the signing surface;
  // `signerComplete` advances the cockpit to payment.
  if (signURL) {
    return (
      <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)]">
        <AnvilEmbedFrame
          iframeURL={signURL}
          scroll="auto"
          onEvent={(event: { action?: string }) => {
            if (event?.action === "signerComplete") onSigned();
          }}
          className="w-full"
          style={{ border: "none", width: "100%", minHeight: 680 }}
        />
        <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-t px-4 py-3">
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
            Secured by Anvil · Legally binding e-signature
          </span>
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
            Audit trail preserved
          </span>
        </div>
      </div>
    );
  }

  const busy = status === "loading";

  return (
    <div>
      <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] p-8">
        <div className="mx-auto w-full max-w-[480px]">
          {/* Capital Partner signature — triggers the embedded ceremony */}
          <div className="mb-8">
            <div className="mb-3 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
              Capital Partner Signature
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <button
                  type="button"
                  onClick={startSigning}
                  disabled={busy}
                  className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-6 text-center font-mono text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--color-text-accent)] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
                >
                  {busy ? "Preparing document…" : "Click to sign"}
                </button>
                <div className="mt-2 text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  {d.partner.contact}
                </div>
                <div className="text-[0.75rem] text-[color:var(--color-text-subtle)]">
                  {d.partner.title}, {d.partner.firm}
                </div>
                {error && (
                  <div className="mt-2 font-mono text-[0.625rem] text-[color:var(--color-state-warn)]">
                    {error}
                  </div>
                )}
              </div>
              <div className="shrink-0 pb-8">
                <div className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                  Date
                </div>
                <div className="mt-1 border-b border-[color:var(--color-border-default)] pb-1 text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  —
                </div>
              </div>
            </div>
          </div>

          <div className="my-6 h-px bg-[color:var(--color-border-subtle)]" />

          {/* Originator signature (pre-signed) */}
          <div>
            <div className="mb-3 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
              Originator Signature
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] py-6 text-center font-display text-[1.25rem] italic text-[color:var(--color-text-muted)]">
                  Rare Structure LLC
                </div>
                <div className="mt-2 text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  Rare Structure LLC
                </div>
                <div className="text-[0.75rem] text-[color:var(--color-text-subtle)]">
                  Catalyst Origination Desk
                </div>
              </div>
              <div className="shrink-0 pb-8">
                <div className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                  Date
                </div>
                <div className="mt-1 border-b border-[color:var(--color-border-default)] pb-1 text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  {d.date}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
          Secured by Anvil · Legally binding e-signature
        </span>
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
          Audit trail preserved
        </span>
      </div>
    </div>
  );
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[color:var(--color-border-subtle)] pt-3 pb-3">
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-[0.875rem] text-[color:var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function DocumentArea({ onSigned }: { onSigned: () => void }) {
  const d = useDeal();
  const reduced = !!useReducedMotion();
  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[color:var(--color-surface-sunken)] pt-16">
      <div className="mx-auto w-full max-w-[680px] px-8 py-12">
        {/* Document header */}
        <motion.div {...(reduced ? {} : enter(0.2))}>
          <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-[0.9375rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-primary)]">
                  Rare Structure
                </div>
                <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                  Catalyst-Driven Origination
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-accent)]">
                  Engagement Proposal
                </div>
                <div className="mt-1 font-mono text-[0.5625rem] tracking-[0.1em] text-[color:var(--color-text-subtle)]">
                  {d.ref} · {d.date}
                </div>
              </div>
            </div>

            <div className="my-8 h-px bg-[color:var(--color-border-default)]" />

            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="mb-2 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
                  Prepared for
                </div>
                <div className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                  {d.partner.contact}
                </div>
                <div className="text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  {d.partner.title}
                </div>
                <div className="text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  {d.partner.firm}
                </div>
              </div>
              <div>
                <div className="mb-2 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
                  Originated by
                </div>
                <div className="text-[0.875rem] text-[color:var(--color-text-primary)]">
                  Rare Structure LLC
                </div>
                <div className="text-[0.8125rem] text-[color:var(--color-text-muted)]">
                  Catalyst Origination Desk
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Proposed terms */}
        <motion.div className="mt-6" {...(reduced ? {} : enter(0.35))}>
          <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-10">
            <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
              Proposed Terms
            </div>

            <TermRow label="Facility" value={d.terms.facility} />
            <TermRow label="Amount" value={d.terms.amount} />
            <TermRow label="Rate" value={d.terms.rate} />
            <TermRow label="Term" value={d.terms.term} />
            <TermRow label="Collateral" value={d.terms.collateral} />
            <TermRow label="Covenants" value={d.terms.covenants} />
            <TermRow label="Closing Fee" value={d.terms.closingFee} />
            <TermRow label="Minimum Draw" value={d.terms.minimumDraw} />
          </div>
        </motion.div>

        {/* Execution — signing embed */}
        <motion.div className="mt-6" {...(reduced ? {} : enter(0.5))}>
          <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-10">
            <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
              Execution
            </div>

            <SigningEmbed onSigned={onSigned} />
          </div>
        </motion.div>

        {/* Confidentiality footer */}
        <motion.div className="mt-8 pb-12 text-center" {...(reduced ? {} : enter(0.6))}>
          <p className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
            Confidential — prepared exclusively for {d.partner.firm}.
            <br />
            Do not distribute. Originated by Rare Structure LLC.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Payment Area ────────────────────────────────────────
// Rendered after signing. Same shell, sidebar stays.
// Demo mode: interactive UI without real Stripe. When platform-api
// provides a client_secret + publishable_key, swap to real Elements.

function PaymentArea() {
  const d = useDeal();
  const [method, setMethod] = useState<"card" | "ach">("card");
  const [processing, setProcessing] = useState(false);
  const [complete, setComplete] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setComplete(true);
    }, 2000);
  };

  if (complete) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] pt-16">
        <motion.div
          className="max-w-[480px] text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-4 flex size-12 items-center justify-center border border-[color:var(--color-text-accent)] text-[color:var(--color-text-accent)]">
            <svg
              aria-hidden="true"
              width="24"
              height="24"
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
          <div className="font-display text-[1.25rem] font-semibold text-[color:var(--color-text-primary)]">
            Payment Received
          </div>
          <p className="mt-3 text-[0.875rem] text-[color:var(--color-text-muted)]">
            A confirmation has been sent to {d.partner.contact} at {d.partner.firm}. The engagement
            is now active.
          </p>
          <div className="mt-6 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
            {d.ref} · Executed · Paid
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[color:var(--color-surface-sunken)] pt-16">
      <div className="mx-auto w-full max-w-[520px] px-8 py-12">
        {/* Signed confirmation */}
        <motion.div
          className="mb-10 flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <svg
            aria-hidden="true"
            className="text-[color:var(--color-text-accent)]"
            width="18"
            height="18"
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
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[color:var(--color-text-accent)]">
            Agreement Executed
          </span>
        </motion.div>

        {/* Amount */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="mb-2 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            {d.engagement.description}
          </div>
          <div className="font-display text-[3rem] font-semibold tracking-tight text-[color:var(--color-text-primary)]">
            {d.engagement.fee}
          </div>
          <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            {d.engagement.paymentTerms}
          </div>
        </motion.div>

        {/* Method selector */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="mb-4 text-center font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            Payment Method
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod("card")}
              className={`flex items-center justify-center gap-2 border py-3.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-all ${
                method === "card"
                  ? "border-[color:var(--color-text-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              Card
            </button>
            <button
              type="button"
              onClick={() => setMethod("ach")}
              className={`flex items-center justify-center gap-2 border py-3.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-all ${
                method === "ach"
                  ? "border-[color:var(--color-text-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              ACH Bank Transfer
            </button>
          </div>
        </motion.div>

        {/* Payment form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-8">
            {method === "card" ? (
              <div>
                {/* Mock card form — replaced by Stripe PaymentElement when keys are wired */}
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="card-number"
                      className="mb-2 block font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
                    >
                      Card Number
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-4 py-3 font-mono text-[0.875rem] tabular-nums text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="card-expiration"
                        className="mb-2 block font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
                      >
                        Expiration
                      </label>
                      <input
                        id="card-expiration"
                        type="text"
                        placeholder="MM / YY"
                        className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-4 py-3 font-mono text-[0.875rem] text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="card-cvc"
                        className="mb-2 block font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
                      >
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="text"
                        placeholder="123"
                        className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-4 py-3 font-mono text-[0.875rem] text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={processing}
                  className="mt-6 w-full border border-[color:var(--color-text-primary)] bg-[color:var(--color-text-primary)] py-3.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-surface-base)] transition-all hover:bg-[color:var(--color-text-accent)] disabled:opacity-40"
                >
                  {processing ? "Processing..." : `Pay ${d.engagement.fee}`}
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-6 text-[0.8125rem] leading-[1.6] text-[color:var(--color-text-muted)]">
                  ACH transfers typically arrive within 1–3 business days. The engagement activates
                  upon receipt of funds.
                </p>

                <div className="space-y-0">
                  {[
                    { label: "Account Name", value: "Rare Structure LLC" },
                    { label: "Routing Number", value: "●●●●●●●●●" },
                    { label: "Account Number", value: "●●●●●●●●●●●●" },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between py-3 ${
                        i < arr.length - 1
                          ? "border-b border-[color:var(--color-border-subtle)]"
                          : ""
                      }`}
                    >
                      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                        {row.label}
                      </span>
                      <span className="font-mono text-[0.8125rem] tabular-nums text-[color:var(--color-text-primary)]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-4">
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                    Reference
                  </div>
                  <div className="font-mono text-[0.8125rem] text-[color:var(--color-text-primary)]">
                    {d.ref}
                  </div>
                </div>

                <div className="mt-4 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[color:var(--color-text-subtle)]">
                  Bank details provided upon engagement execution. Contact the origination desk for
                  wire instructions.
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
              Payments secured by Stripe
            </span>
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
              PCI compliant
            </span>
          </div>
        </motion.div>

        {/* Contact */}
        <div className="mt-10 text-center">
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
            {d.ref} · Confidential
          </span>
        </div>
      </div>
    </div>
  );
}

function ProposalView() {
  const [phase, setPhase] = useState<"proposal" | "payment">("proposal");

  return (
    <div className="flex h-screen bg-[color:var(--color-surface-base)]">
      <Sidebar />
      <AnimatePresence mode="wait">
        {phase === "proposal" ? (
          <motion.div
            key="proposal"
            className="flex flex-1"
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <DocumentArea onSigned={() => setPhase("payment")} />
          </motion.div>
        ) : (
          <motion.div
            key="payment"
            className="flex flex-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <PaymentArea />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Dark-theme placeholder shown while the deal for `:ref` resolves.
function ProposalLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[color:var(--color-surface-base)]">
      <div className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
        Loading proposal…
      </div>
    </div>
  );
}

// Bare /proposal has no ref → nothing to show. Render a branded prompt rather
// than a blank screen; a specific deal is never shown without its ref.
function ProposalMissingRef() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[color:var(--color-surface-base)] px-6 text-center">
      <div className="font-display font-semibold text-[0.9375rem] uppercase tracking-[0.18em] text-[color:var(--color-text-primary)]">
        Rare Structure
      </div>
      <div className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
        Engagement Proposal
      </div>
      <p className="max-w-[420px] text-[0.8125rem] leading-relaxed text-[color:var(--color-text-muted)]">
        This proposal link requires a reference. Open the personalized URL from
        your engagement email — e.g.{" "}
        <span className="text-[color:var(--color-text-primary)]">/proposal/RS-2026-0847</span>.
      </p>
    </div>
  );
}

/**
 * Proposal — public capability route mounted at `/proposal/:ref`.
 *
 * The `:ref` itself is the credential (an unguessable proposal reference), so
 * the fetch is intentionally unauthenticated — no Supabase bearer, unlike the
 * authenticated surfaces. `getProposal` hits the platform-api BFF; until that
 * endpoint lands (the Anvil wiring phase) it returns null and we fall back to
 * the bundled fixture so the surface stays fully interactive.
 */
export default function Proposal() {
  const { ref } = useParams<{ ref?: string }>();
  const [deal, setDeal] = useState<ProposalDeal | null>(null);

  useEffect(() => {
    if (!ref) return; // bare /proposal — render the missing-ref prompt below
    let active = true;
    setDeal(null);
    getProposal(ref).then((fetched) => {
      if (!active) return;
      // Fixture fallback keeps the page live pre-backend; the swap point is
      // `getProposal` returning a real deal for this ref.
      setDeal(fetched ?? { ...PROPOSAL_DEAL, ref });
    });
    return () => {
      active = false;
    };
  }, [ref]);

  if (!ref) return <ProposalMissingRef />;
  if (!deal) return <ProposalLoading />;

  return (
    <DealContext.Provider value={deal}>
      <ProposalView />
    </DealContext.Provider>
  );
}
