/**
 * DocumentPaymentPage — the ACH payment view at `/p/m/:opportunityId/:documentId/pay`.
 *
 * The step after signing in the direct-to-documenso flow (reached from DocumentSignedConfirmation's
 * "Continue to payment" CTA). It mints the ACH PaymentIntent via the BFF (amount resolved server-side
 * from `fee_amount` — never hardcoded) and mounts Stripe Elements. Keyed by the (opportunity, document)
 * PAIR, not a proposal ref.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; this page polls
 * `getDocumentPaymentState` for the settled status.
 */
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { type Appearance, type Stripe, loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import {
  type DocumentPaymentInit,
  PaymentError,
  createDocumentPaymentIntent,
  getDocumentPaymentState,
} from "@/proposals/api";
import { DOCUMENSO_CSS_VARS as T } from "@/proposals/documensoTheme";

// Stripe Appearance from the brand token palette — parity with the signing surface.
const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: T.ring,
    colorBackground: T.input,
    colorText: T.foreground,
    colorTextSecondary: T.mutedForeground,
    colorDanger: T.destructive,
    fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "0px",
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

type PayState =
  | { kind: "loading" }
  | { kind: "ready"; init: DocumentPaymentInit }
  | { kind: "paid" }
  | { kind: "unsigned" }
  | { kind: "unavailable" };

export default function DocumentPaymentPage() {
  const { opportunityId, documentId } = useParams<{
    opportunityId: string;
    documentId: string;
  }>();
  const [pay, setPay] = useState<PayState>({ kind: "loading" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mint (or reuse) the intent once the pair is known. If already settled, short-circuit to "paid".
  useEffect(() => {
    if (!opportunityId || !documentId) return;
    let active = true;
    (async () => {
      const existing = await getDocumentPaymentState(opportunityId, documentId).catch(() => null);
      if (!active) return;
      if (existing?.paymentStatus === "succeeded") {
        setPay({ kind: "paid" });
        return;
      }
      try {
        const init = await createDocumentPaymentIntent(opportunityId, documentId);
        if (active) setPay({ kind: "ready", init });
      } catch (e) {
        if (!active) return;
        if (e instanceof PaymentError && e.status === 409) {
          // 409 = "agreement not yet signed" (the common gate). An "already paid" race resolves via
          // the poll/state read; treat the gate as "sign first".
          setPay(/already paid/i.test(e.message) ? { kind: "paid" } : { kind: "unsigned" });
        } else {
          setPay({ kind: "unavailable" });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [opportunityId, documentId]);

  // After the client authorizes the debit, poll the authoritative state until it settles.
  const startPolling = () => {
    if (!opportunityId || !documentId || pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      const s = await getDocumentPaymentState(opportunityId, documentId).catch(() => null);
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

  let note: React.ReactNode = null;
  let form: { init: DocumentPaymentInit; opportunityId: string; documentId: string } | null = null;
  if (pay.kind === "loading") {
    note = <Note>Preparing payment…</Note>;
  } else if (!opportunityId || !documentId) {
    note = <Note>This payment link is invalid or has expired.</Note>;
  } else if (pay.kind === "paid") {
    note = <Note>Payment received — this engagement is active.</Note>;
  } else if (pay.kind === "unsigned") {
    note = <Note>Sign the engagement agreement before payment. Return to the document to continue.</Note>;
  } else if (pay.kind === "unavailable") {
    note = <Note>Payment is temporarily unavailable. Please try again shortly.</Note>;
  } else {
    form = { init: pay.init, opportunityId, documentId };
  }

  return (
    <DocumentFrame
      title="Engagement Payment"
      headerAccessory={<PaymentPill paid={pay.kind === "paid"} />}
      hideTrustStrip
      backHref={opportunityId && documentId ? `/p/m/${opportunityId}/${documentId}` : undefined}
      maxWidthClass="max-w-[768px]"
    >
      {form ? (
        <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
          <div className="mb-8 border-[color:var(--color-border-subtle)] border-b pb-5 text-center">
            <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Amount due
            </div>
            <div className="text-[1.75rem] text-[color:var(--color-text-primary)] tabular-nums">
              {formatUsdCents(form.init.amountCents, form.init.currency)}
            </div>
          </div>
          <AchPaymentForm
            init={form.init}
            opportunityId={form.opportunityId}
            documentId={form.documentId}
            onSettledPoll={startPolling}
          />
        </div>
      ) : (
        note
      )}
    </DocumentFrame>
  );
}

// Stripe Elements provider + ACH form, scoped to the minted intent's client secret.
function AchPaymentForm({
  init,
  opportunityId,
  documentId,
  onSettledPoll,
}: {
  init: DocumentPaymentInit;
  opportunityId: string;
  documentId: string;
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
        opportunityId={opportunityId}
        documentId={documentId}
        onSettledPoll={onSettledPoll}
      />
    </Elements>
  );
}

type Phase = "idle" | "processing" | "succeeded";

function AchForm({
  opportunityId,
  documentId,
  onSettledPoll,
}: {
  opportunityId: string;
  documentId: string;
  onSettledPoll: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elementReady, setElementReady] = useState(false);

  // Reveal the PaymentElement only once Stripe signals it has rendered — its iframe paints white
  // before the dark Elements appearance applies, so we hold a dark veil over it until ready (mirrors
  // the signing embed's dark-veil fix). A timeout fallback reveals it even if `onReady` is missed, so
  // it can never get stuck hidden.
  useEffect(() => {
    if (elementReady) return;
    const t = setTimeout(() => setElementReady(true), 4000);
    return () => clearTimeout(t);
  }, [elementReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/p/m/${opportunityId}/${documentId}/pay?status=submitted`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      // Field-level validation (incomplete email, missing name, no bank linked) is surfaced inline by
      // the PaymentElement itself — don't echo it as a page-level error. Only show genuine
      // processing/API failures here.
      if (result.error.type !== "validation_error") {
        setError(result.error.message ?? "Payment could not be initiated.");
      }
      setSubmitting(false);
      return;
    }
    // ACH → 'processing' (settles in 1-3 business days). The webhook is authoritative either way; kick
    // the page's poll for the settled state.
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
      {/* Dark veil over the Stripe iframe until it's rendered — masks the white, unstyled paint the
          PaymentElement shows before its appearance applies. */}
      <div className="relative bg-[color:var(--color-surface-base)]">
        <div
          className={`transition-opacity duration-300 ${elementReady ? "opacity-100" : "opacity-0"}`}
        >
          <PaymentElement
            options={{ fields: { billingDetails: { name: "auto", email: "auto" } } }}
            onReady={() => setElementReady(true)}
          />
        </div>
        {!elementReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-surface-base)]">
            <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.18em]">
              Loading secure payment…
            </div>
          </div>
        )}
      </div>
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
        {submitting ? "Authorizing…" : "Authorize payment"}
      </button>
      <p className="text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
        US bank account · settles in 1–3 business days · powered by Stripe
      </p>
    </form>
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

// Header pill for the payment surface — speaks the PAYMENT lifecycle (not signing). Mirrors the house
// StatusPill styling; replaces the default frame pill via DocumentFrame's headerAccessory slot.
function PaymentPill({ paid }: { paid: boolean }) {
  const tone = paid
    ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
    : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)]";
  return (
    <span
      className={`shrink-0 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] ${tone}`}
    >
      {paid ? "Paid" : "Awaiting payment"}
    </span>
  );
}
