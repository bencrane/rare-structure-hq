/**
 * StripePaymentSection — the ACH (us_bank_account) payment surface for `/p/:ref/pay`.
 *
 * Card is never offered: the PaymentIntent is created server-side (edge_api) with
 * `payment_method_types=['us_bank_account']`, so the PaymentElement renders bank-account collection
 * only. The Elements `appearance` is derived from the Rare Structure token palette (the same hexes
 * the Documenso embed uses) so this reads as one continuous surface with the signing step.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The
 * authoritative "paid" transition arrives later via the Stripe webhook → edge_api; this component
 * reports "initiated" and the page polls `getPaymentState` for the settled status.
 */
import type { PaymentInit } from "@rare-structure-hq/shared";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { type Appearance, type Stripe, loadStripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";

import { DOCUMENSO_CSS_VARS as T } from "./documensoTheme";

// Stripe Appearance from the brand token palette — parity with the signing surface.
const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: T.ring, // #7b9fd4 — the visible accent
    colorBackground: T.input, // #050812 — sunken field surface
    colorText: T.foreground, // #e4e4e7
    colorTextSecondary: T.mutedForeground, // #a1a1aa
    colorDanger: T.destructive, // #f87171
    fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "0px", // sharp-edge house style
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: `1px solid ${T.border}`, backgroundColor: T.input, boxShadow: "none" },
    ".Input:focus": { border: `1px solid ${T.ring}`, boxShadow: "none" },
    ".Label": {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: T.mutedForeground,
    },
    ".Tab, .Block": { backgroundColor: T.muted, border: `1px solid ${T.border}` },
    ".Tab--selected": { borderColor: T.ring },
  },
};

function formatUsdCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Phase = "idle" | "processing" | "succeeded";

function AchForm({
  amountCents,
  currency,
  proposalRef,
  clientName,
  onSettledPoll,
}: {
  amountCents: number;
  currency: string;
  proposalRef: string;
  clientName: string;
  onSettledPoll: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/p/${proposalRef}/pay?status=submitted`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Payment could not be initiated.");
      setSubmitting(false);
      return;
    }
    // ACH → 'processing' (settles in 1-3 business days). The webhook is authoritative either way;
    // kick the page's poll for the settled state.
    const status = result.paymentIntent?.status;
    setPhase(status === "succeeded" ? "succeeded" : "processing");
    setSubmitting(false);
    onSettledPoll();
  };

  if (phase !== "idle") {
    const settled = phase === "succeeded";
    return (
      <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] p-8 text-center">
        <div className="font-display font-semibold text-[1.0625rem] text-[color:var(--color-text-primary)]">
          {settled ? "Payment received" : "Payment initiated"}
        </div>
        <p className="mt-2 text-[0.875rem] text-[color:var(--color-text-muted)] leading-[1.55]">
          {settled
            ? "Funds have settled — the engagement is active."
            : "Your bank debit is authorized. ACH transfers settle in 1–3 business days; the engagement activates on settlement. You can close this page."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          defaultValues: { billingDetails: { name: clientName } },
          fields: { billingDetails: { name: "auto", email: "auto" } },
        }}
      />
      {error ? (
        <p className="font-mono text-[0.6875rem] text-[color:var(--color-state-error,#f87171)]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-4 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting
          ? "Authorizing…"
          : `Authorize ACH debit · ${formatUsdCents(amountCents, currency)}`}
      </button>
      <p className="text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
        US bank account · settles in 1–3 business days · powered by Stripe
      </p>
    </form>
  );
}

export function StripePaymentSection({
  init,
  proposalRef,
  clientName,
  onSettledPoll,
}: {
  init: PaymentInit;
  proposalRef: string;
  clientName: string;
  onSettledPoll: () => void;
}) {
  const stripePromise = useMemo<Promise<Stripe | null>>(
    () => loadStripe(init.publishableKey),
    [init.publishableKey],
  );
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: init.clientSecret, appearance: STRIPE_APPEARANCE }}
    >
      <AchForm
        amountCents={init.amountCents}
        currency={init.currency}
        proposalRef={proposalRef}
        clientName={clientName}
        onSettledPoll={onSettledPoll}
      />
    </Elements>
  );
}
