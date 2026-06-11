/**
 * PaymentPage — the ACH payment view at `/p/:ref/pay`.
 *
 * The step after signing: housed in the shared `DocumentFrame` so it reads as a continuation
 * of the summary (`/p/:ref`) and signing (`/p/:ref/sign`) surfaces. It mints the ACH PaymentIntent
 * via the BFF (amount resolved server-side from the proposal — never hardcoded) and mounts Stripe
 * Elements. `paid` is authoritative only via the webhook; this page polls for the settled state.
 */
import type { PaymentInit } from "@rare-structure-hq/shared";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
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

export default function PaymentPage() {
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

  // Non-form states render a centered note; `form` carries the ready-state data so the
  // payment body renders inline under <DocumentFrame> — which owns the route
  // geometry — instead of as top-level route JSX (no-route-geometry lint).
  let note: React.ReactNode = null;
  let form: { init: PaymentInit; ref: string; clientName: string } | null = null;
  if (shellState === "loading" || pay.kind === "loading") {
    note = <Note>Preparing payment…</Note>;
  } else if (shellState === "notfound" || !shell || !ref) {
    note = <Note>This payment link is invalid or has expired.</Note>;
  } else if (pay.kind === "paid") {
    note = <Note>Payment received — this engagement is active.</Note>;
  } else if (pay.kind === "unsigned") {
    note = (
      <Note>Sign the engagement agreement before payment. Return to the proposal to continue.</Note>
    );
  } else if (pay.kind === "unavailable") {
    note = <Note>Payment is temporarily unavailable. Please try again shortly.</Note>;
  } else {
    form = { init: pay.init, ref, clientName: shell.client.name };
  }

  return (
    <DocumentFrame
      title="Engagement Payment"
      status={shell?.status}
      backHref={ref ? `/p/${ref}` : "/"}
      maxWidthClass="max-w-[768px]"
    >
      {form ? (
        <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
          <div className="mb-8 border-[color:var(--color-border-subtle)] border-b pb-5">
            <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Amount due · quarterly, in advance
            </div>
            <div className="text-[1.75rem] text-[color:var(--color-text-primary)] tabular-nums">
              {formatUsdCents(form.init.amountCents, form.init.currency)}
            </div>
            <div className="mt-1 text-[0.8125rem] text-[color:var(--color-text-muted)]">
              {form.clientName}
            </div>
          </div>
          <StripePaymentSection
            init={form.init}
            proposalRef={form.ref}
            clientName={form.clientName}
            onSettledPoll={startPolling}
          />
        </div>
      ) : (
        note
      )}
    </DocumentFrame>
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
