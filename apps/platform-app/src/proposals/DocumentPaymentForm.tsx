/**
 * DocumentPaymentForm — the staged ACH payment form for the direct-to-documenso engagement fee,
 * rendered inside DocumentPaymentPage's DocumentFrame at `/p/m/:opportunityId/:documentId/pay`.
 *
 * Lives in `proposals/` (alongside StripePaymentSection, the proposal-ref ACH form) deliberately: it
 * owns form geometry on behalf of the route, which keeps the `no-route-geometry` lint where it belongs
 * (the route stays content/state-only and drops this body into the frame).
 *
 * STRUCTURE — two staged sections, progressively disclosed so the prospect isn't met with the whole
 * bank grid on load:
 *   Step 01 "Your details" — email + full name collected by OUR OWN native inputs, NOT Stripe's. The
 *     PaymentElement is told `fields.billingDetails: never`, so these no longer render buried under
 *     Stripe's "US bank account" header; they live in their own section and are supplied at confirm via
 *     `payment_method_data.billing_details`. For `us_bank_account` BOTH name and email are required
 *     PaymentMethod fields — supplying either without the other (or neither) throws a synchronous
 *     IntegrationError before the bank flow runs, so the native inputs are LOAD-BEARING, not cosmetic,
 *     and we validate them ourselves (Stripe no longer does).
 *   Step 02 "Bank account" — the Stripe `us_bank_account` collection (Financial Connections: search /
 *     instant bank-login, or "enter details manually" → routing+account / microdeposits). It mounts
 *     only once Step 01 validates; until then Step 02 shows a locked placeholder. The two collection
 *     paths live INSIDE Stripe's iframe — external tabs cannot drive that mode, so we FRAME them with a
 *     section hint, we don't re-tab them. The reveal is LATCHED: once mounted the Elements subtree is
 *     never unmounted, so a transiently-invalid email mid-edit can't destroy the live Financial
 *     Connections session.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; the route polls
 * `getDocumentPaymentState` for the settled status (via `onSettledPoll`).
 */
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { type Appearance, type Stripe, loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";

import type { DocumentPaymentInit } from "./api";
import { DOCUMENSO_CSS_VARS as T } from "./documensoTheme";

// Stripe Appearance from the brand token palette — parity with the signing surface and with our own
// native "Your details" inputs (same border / surface / focus ring), so the two read as one system.
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

// Native-input validity gate. Stripe no longer validates email/name (they're set to `never` on the
// PaymentElement), so this is the authoritative check before the bank step unlocks and before submit.
const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// The staged form: Step 01 (our native details) gates Step 02 (the Stripe bank step). Owns the
// email/name state that the bank step's confirm call depends on, and the latched reveal.
export function DocumentPaymentForm({
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
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const detailsValid = isEmail(email) && fullName.trim().length > 1;

  // Reveal (and mount) the bank step once details validate. LATCHED: once revealed it never
  // un-mounts — a transiently-invalid email mid-edit must not destroy the live Financial Connections
  // session inside the PaymentElement. The Authorize button re-checks `detailsValid` to gate submit.
  const [revealBank, setRevealBank] = useState(false);
  useEffect(() => {
    if (detailsValid && !revealBank) setRevealBank(true);
  }, [detailsValid, revealBank]);

  // Only nag once they've typed something — never an error on a pristine field.
  const emailError = email.length > 0 && !isEmail(email) ? "Enter a valid email" : undefined;

  return (
    <div className="px-6 pt-10 pb-14 md:px-12 md:pt-12 md:pb-16">
      <div className="mb-10 border-[color:var(--color-border-subtle)] border-b pb-6 text-center">
        <div className="mb-1.5 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Amount due
        </div>
        <div className="text-[1.75rem] text-[color:var(--color-text-primary)] tabular-nums">
          {formatUsdCents(init.amountCents, init.currency)}
        </div>
      </div>

      <StepSection
        index="01"
        label="Your details"
        hint="Where your receipt and any verification notices are sent."
        active
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="pay-name"
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="First and last name"
            autoComplete="name"
          />
          <Field
            id="pay-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            error={emailError}
          />
        </div>
      </StepSection>

      <StepSection
        index="02"
        label="Bank account"
        hint="Find your bank to verify instantly, or enter your account details manually."
        active={revealBank}
        divider
      >
        {revealBank ? (
          <AchPaymentForm
            init={init}
            opportunityId={opportunityId}
            documentId={documentId}
            name={fullName}
            email={email}
            canSubmit={detailsValid}
            onSettledPoll={onSettledPoll}
          />
        ) : (
          <LockedNote>Complete your details above to continue.</LockedNote>
        )}
      </StepSection>
    </div>
  );
}

// One staged section: a mono step index + label (accent once `active`) over a hint and the body.
function StepSection({
  index,
  label,
  hint,
  active,
  divider = false,
  children,
}: {
  index: string;
  label: string;
  hint: string;
  active: boolean;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={divider ? "mt-10 border-[color:var(--color-border-subtle)] border-t pt-10" : ""}
    >
      <div className="flex items-baseline gap-3">
        <span
          className={`font-mono text-[0.625rem] tabular-nums tracking-[0.18em] transition-colors ${
            active
              ? "text-[color:var(--color-text-accent)]"
              : "text-[color:var(--color-text-subtle)]"
          }`}
        >
          {index}
        </span>
        <span
          className={`font-mono text-[0.6875rem] uppercase tracking-[0.18em] transition-colors ${
            active
              ? "text-[color:var(--color-text-primary)]"
              : "text-[color:var(--color-text-muted)]"
          }`}
        >
          {label}
        </span>
      </div>
      <p className="mt-2 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase leading-[1.7] tracking-[0.12em]">
        {hint}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

// Native text/email field — styled to match the Stripe PaymentElement's `.Input` rules (same border,
// sunken surface, accent focus ring) so the "Your details" section reads as one surface with the bank
// step below it.
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  autoComplete?: string;
  inputMode?: "text" | "email";
  error?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.1em]">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={`w-full border bg-[color:var(--color-surface-sunken)] px-3.5 py-3 font-sans text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-subtle)] ${
          error
            ? "border-[color:var(--color-state-error,#f87171)]"
            : "border-[color:var(--color-border-default)] focus:border-[color:var(--color-text-accent)]"
        }`}
      />
      {error ? (
        <span className="mt-1.5 block font-mono text-[0.5625rem] text-[color:var(--color-state-error,#f87171)] uppercase tracking-[0.1em]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

// Step 02's placeholder before the details validate — keeps the staged roadmap visible without
// dropping the whole bank grid on the prospect.
function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center border border-[color:var(--color-border-subtle)] border-dashed bg-[color:var(--color-surface-sunken)] px-6 py-10 text-center">
      <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase leading-[1.7] tracking-[0.16em]">
        {children}
      </span>
    </div>
  );
}

// Stripe Elements provider + ACH form, scoped to the minted intent's client secret. Mounted only once
// Step 01 validates (and never unmounted thereafter).
function AchPaymentForm({
  init,
  opportunityId,
  documentId,
  name,
  email,
  canSubmit,
  onSettledPoll,
}: {
  init: DocumentPaymentInit;
  opportunityId: string;
  documentId: string;
  name: string;
  email: string;
  canSubmit: boolean;
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
        name={name}
        email={email}
        canSubmit={canSubmit}
        onSettledPoll={onSettledPoll}
      />
    </Elements>
  );
}

type Phase = "idle" | "processing" | "succeeded";

function AchForm({
  opportunityId,
  documentId,
  name,
  email,
  canSubmit,
  onSettledPoll,
}: {
  opportunityId: string;
  documentId: string;
  name: string;
  email: string;
  canSubmit: boolean;
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
    if (!stripe || !elements || !canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // billingDetails are set to `never` on the PaymentElement (collected by our own "Your details"
        // inputs), so name + email MUST be supplied here — for us_bank_account BOTH are required
        // PaymentMethod fields. Omitting either throws a synchronous IntegrationError before the bank
        // flow runs; `canSubmit` (Step 01 validity) is the guard that keeps us from reaching that.
        payment_method_data: {
          billing_details: { name: name.trim(), email: email.trim() },
        },
        return_url: `${window.location.origin}/p/m/${opportunityId}/${documentId}/pay?status=submitted`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      // Field-level validation (incomplete bank link) is surfaced inline by the PaymentElement itself —
      // don't echo it as a page-level error. Only show genuine processing/API failures here.
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
            options={{ fields: { billingDetails: { name: "never", email: "never" } } }}
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
        disabled={!stripe || submitting || !canSubmit}
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

// Header pill for the payment surface — speaks the PAYMENT lifecycle (not signing). Mirrors the house
// StatusPill styling; replaces the default frame pill via DocumentFrame's headerAccessory slot.
export function PaymentPill({ paid }: { paid: boolean }) {
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
