/**
 * PayPage — the ACH payment view at `/p/:ref/pay`.
 *
 * The step after signing: housed in the shared `ProposalViewerShell` so it reads as a continuation
 * of the summary (`/p/:ref`) and signing (`/p/:ref/sign`) surfaces. It mints the ACH PaymentIntent
 * via the BFF (amount resolved server-side from the proposal — never hardcoded) and mounts Stripe
 * Elements. `paid` is authoritative only via the webhook; this page polls for the settled state.
 */
import type { PaymentInit } from "@rare-structure-hq/shared";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { ProposalViewerShell } from "@/proposals/ProposalViewerShell";
import { StripePaymentSection } from "@/proposals/StripePaymentSection";
import {
  PaymentError,
  createPaymentIntent,
  getPaymentState,
  getProposalShell,
} from "@/proposals/api";
import { useProposalShell } from "@/proposals/useProposalShell";

type PayState =
  | { kind: "loading" }
  | { kind: "ready"; init: PaymentInit }
  | { kind: "paid" }
  | { kind: "unsigned" }
  | { kind: "unavailable" };

function formatUsdCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function PayPage() {
  const { ref } = useParams<{ ref: string }>();
  const { shell, state: shellState } = useProposalShell(ref, getProposalShell);
  const [pay, setPay] = useState<PayState>({ kind: "loading" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mint (or reuse) the intent once the ref is known. If already settled, short-circuit to "paid".
  useEffect(() => {
    if (!ref) return;
    let active = true;
    (async () => {
      const existing = await getPaymentState(ref).catch(() => null);
      if (!active) return;
      if (existing?.paymentStatus === "succeeded") {
        setPay({ kind: "paid" });
        return;
      }
      try {
        const init = await createPaymentIntent(ref);
        if (active) setPay({ kind: "ready", init });
      } catch (e) {
        if (!active) return;
        if (e instanceof PaymentError && e.status === 409) setPay({ kind: "unsigned" });
        else setPay({ kind: "unavailable" });
      }
    })();
    return () => {
      active = false;
    };
  }, [ref]);

  // After the client authorizes the debit, poll the authoritative state until it settles.
  const startPolling = () => {
    if (!ref || pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      const s = await getPaymentState(ref).catch(() => null);
      if (s?.paymentStatus === "succeeded") {
        setPay({ kind: "paid" });
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }, 5000);
  };
  useEffect(
    () => () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    },
    [],
  );

  let body: React.ReactNode;
  if (shellState === "loading" || pay.kind === "loading") {
    body = <Note>Preparing payment…</Note>;
  } else if (shellState === "notfound" || !shell || !ref) {
    body = <Note>This payment link is invalid or has expired.</Note>;
  } else if (pay.kind === "paid") {
    body = <Note>Payment received — this engagement is active.</Note>;
  } else if (pay.kind === "unsigned") {
    body = (
      <Note>Sign the engagement agreement before payment. Return to the proposal to continue.</Note>
    );
  } else if (pay.kind === "unavailable") {
    body = <Note>Payment is temporarily unavailable. Please try again shortly.</Note>;
  } else {
    body = (
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        <div className="mb-8 border-[color:var(--color-border-subtle)] border-b pb-5">
          <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
            Amount due · quarterly, in advance
          </div>
          <div className="text-[1.75rem] text-[color:var(--color-text-primary)] tabular-nums">
            {formatUsdCents(pay.init.amountCents, pay.init.currency)}
          </div>
          <div className="mt-1 text-[0.8125rem] text-[color:var(--color-text-muted)]">
            {shell.client.name}
          </div>
        </div>
        <StripePaymentSection
          init={pay.init}
          proposalRef={ref}
          clientName={shell.client.name}
          onSettledPoll={startPolling}
        />
      </div>
    );
  }

  return (
    <ProposalViewerShell
      title="Engagement Payment"
      status={shell?.status}
      backHref={ref ? `/p/${ref}` : "/"}
      maxWidthClass="max-w-[768px]"
    >
      {body}
    </ProposalViewerShell>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-center">
      <div className="max-w-[420px] px-6 font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase leading-[1.8] tracking-[0.18em]">
        {children}
      </div>
    </div>
  );
}
