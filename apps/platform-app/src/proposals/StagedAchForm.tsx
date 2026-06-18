/**
 * StagedAchForm — the single staged ACH (us_bank_account) billing body shared by BOTH pay surfaces:
 * the proposal-ref flow (`StripePaymentSection` → `/p/:ref/pay`) and the direct-to-documenso flow
 * (`DocumentPaymentForm` → `/p/m/:opportunityId/:documentId/pay`). One implementation, so the two
 * surfaces can never silently drift in billing-collection behavior.
 *
 * Lives in `proposals/` (not `routes/`) deliberately: it owns form geometry on behalf of whichever
 * route mounts it, which keeps the `no-route-geometry` lint where it belongs (routes stay
 * content/state-only and drop a wrapper — amount header + padding — around this body).
 *
 * STRUCTURE — two staged sections, progressively disclosed so the prospect isn't met with the whole
 * bank grid on load:
 *   Step 01 "Your details" — email + full name collected by OUR OWN native inputs, NOT Stripe's. The
 *     PaymentElement is told `fields.billingDetails: never`, so these no longer render buried under
 *     Stripe's "US bank account" header; they live in their own section and are supplied at confirm via
 *     `payment_method_data.billing_details`. For `us_bank_account` BOTH name and email are required
 *     PaymentMethod fields — supplying either without the other (or neither) throws a synchronous
 *     IntegrationError before the bank flow runs, so the native inputs are LOAD-BEARING, not cosmetic,
 *     and we validate them ourselves (Stripe no longer does). `nameDefault` seeds the name input (the
 *     proposal flow passes the known `clientName`); the email is always collected.
 *   Step 02 "Bank account" / "Payment method" — the Stripe payment collection. ACH-only by default
 *     (`us_bank_account` Financial Connections: search / instant bank-login, or "enter details
 *     manually"). When `enableCard` is set (the document flow), the minted intent carries BOTH `card`
 *     and `us_bank_account`, and the PaymentElement renders Stripe's "Card | US bank account" tabs
 *     (`layout:{type:"tabs"}`) — the prospect's neutral two-choice. Card captures synchronously (instant
 *     activation); ACH settles asynchronously. The billing-details split is unchanged and load-bearing
 *     either way: the union of requirements on a dual-method intent still forces name+email, so Step 01
 *     stays mandatory. It mounts only once Step 01 validates; until then Step 02 shows a locked
 *     placeholder. The reveal is LATCHED: once mounted the Elements subtree is never unmounted, so a
 *     transiently-invalid email mid-edit can't destroy the live Financial Connections session.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; the mounting route polls its
 * payment-state endpoint for the settled status (via `onSettledPoll`).
 */
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { type Appearance, type Stripe, loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";

import { DOCUMENSO_CSS_VARS as T } from "./documensoTheme";

// The four fields this form reads off the minted intent. Both `PaymentInit` (proposal) and
// `DocumentPaymentInit` (document) satisfy this shape structurally, so either surface can pass its init.
export interface StagedAchInit {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
}

// Optimistic settlement hint passed from the in-form confirm result to the mounting route, so the
// post-payment screen shows the RIGHT outcome immediately (card → succeeded, ACH → processing) rather
// than waiting for the server poll to resolve — which could momentarily mislabel a card success as an
// ACH "settles in 1–3 days" screen during the webhook race. The poll still refines with server truth.
export type SettledHint = { status: "succeeded" | "processing"; rail: string | null };

// Stripe Appearance from the brand token palette — parity with the signing surface and with our own
// native "Your details" inputs (same border / surface / focus ring), so the two read as one system.
const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: T.ring,
    colorBackground: T.input,
    colorText: T.foreground,
    colorTextSecondary: T.mutedForeground,
    // Set explicitly: against our extra-dark colorBackground (#050812) Stripe's auto-derived
    // placeholder/icon colors come out near-invisible. Pin them to visible token greys.
    colorTextPlaceholder: T.mutedForeground,
    colorIcon: T.mutedForeground,
    colorIconTab: T.mutedForeground,
    colorIconTabSelected: T.foreground,
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
    ".Tab, .Block": {
      backgroundColor: T.muted,
      border: `1px solid ${T.border}`,
      color: T.mutedForeground,
    },
    ".Tab:hover": { borderColor: T.ring },
    // Selected rail reads as a deliberate choice — accent border + ring on the sunken surface. This
    // is the entire "Card | US bank account" two-choice styling (the tabs are Stripe's, framed by us).
    // `color` is load-bearing: the selected background (#050812) is near-black, so without an explicit
    // light label color Stripe derives a dark one and the selected tab's text/icon vanish.
    ".Tab--selected": {
      borderColor: T.ring,
      backgroundColor: T.input,
      color: T.foreground,
      boxShadow: `0 0 0 1px ${T.ring}`,
    },
    ".TabLabel--selected": { color: T.foreground },
  },
};

export function formatUsdCents(cents: number, currency = "usd"): string {
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
// email/name state that the bank step's confirm call depends on, and the latched reveal. The mounting
// surface supplies the success `returnUrl` and the submit-button label; `nameDefault` seeds the name
// input (empty unless the surface already knows the client's name).
export function StagedAchForm({
  init,
  returnUrl,
  onSettledPoll,
  submitLabel,
  nameDefault = "",
  emailDefault = "",
  enableCard = false,
  requireConfirm = false,
}: {
  init: StagedAchInit;
  returnUrl: string;
  onSettledPoll: (hint?: SettledHint) => void;
  submitLabel: string;
  nameDefault?: string;
  /** Seed the email input (the document flow pre-fills the opportunity contact). */
  emailDefault?: string;
  // When set, the minted intent carries both `card` and `us_bank_account`; the PaymentElement renders
  // Stripe's "Card | US bank account" tabs. Default false keeps the proposal-ref surface ACH-only.
  enableCard?: boolean;
  /** Require an explicit "Continue to payment" confirmation of the contact details before the payment
   * step appears (the document flow, where the details are pre-filled). When false the payment step
   * auto-reveals as soon as the details validate (the proposal-ref ACH-only surface). */
  requireConfirm?: boolean;
}) {
  const [email, setEmail] = useState(emailDefault);
  const [emailTouched, setEmailTouched] = useState(false);
  const [fullName, setFullName] = useState(nameDefault);
  const detailsValid = isEmail(email) && fullName.trim().length > 1;

  // Reveal (and mount) the bank step. Proposal surface (auto-reveal): LATCHED — once revealed it never
  // un-mounts, so a transiently-invalid email mid-edit can't destroy the live Financial Connections
  // session. Document surface (confirm): focusing a contact field collapses the payment step back to the
  // "Continue to payment" confirm (see `collapseToConfirm`) — the prospect explicitly chose to revise.
  const [revealBank, setRevealBank] = useState(false);
  useEffect(() => {
    // Auto-reveal only when no explicit confirmation is required (the proposal-ref surface). The
    // document flow gates the reveal behind a "Continue to payment" confirm of the pre-filled details.
    if (!requireConfirm && detailsValid && !revealBank) setRevealBank(true);
  }, [requireConfirm, detailsValid, revealBank]);

  // Confirm (document) surface only: re-focusing a contact field after confirming collapses the payment
  // step, so the prospect re-confirms after editing name/email. No-op on the auto-reveal surface.
  const collapseToConfirm = () => {
    if (requireConfirm && revealBank) setRevealBank(false);
  };

  // Validate on BLUR, never while typing — surfacing "Enter a valid email" on the first keystroke of a
  // half-typed address is hostile. Once the field has been blurred with an invalid value the error
  // shows, and live re-validation clears it the instant the address becomes valid.
  const emailError =
    emailTouched && email.length > 0 && !isEmail(email) ? "Enter a valid email" : undefined;

  return (
    <>
      <StepSection
        index="01"
        label="Contact information"
        hint={
          enableCard ? undefined : "Used for your payment record and any bank-verification notices."
        }
        active
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="pay-name"
            label="Full name"
            value={fullName}
            onChange={setFullName}
            onFocus={collapseToConfirm}
            autoComplete="name"
          />
          <Field
            id="pay-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            onBlur={() => setEmailTouched(true)}
            // Re-entering the field clears the touched gate, so the error never fires while typing —
            // it returns only after blur with an invalid value. Also collapses the payment step (doc flow).
            onFocus={() => {
              setEmailTouched(false);
              collapseToConfirm();
            }}
            autoComplete="email"
            inputMode="email"
            error={emailError}
          />
        </div>
        {/* Confirm step (document flow): the contact is pre-filled, so the prospect confirms (or edits)
            it; only then does the payment step appear. */}
        {requireConfirm && !revealBank ? (
          <button
            type="button"
            disabled={!detailsValid}
            onClick={() => setRevealBank(true)}
            className="mt-6 w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-4 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to payment →
          </button>
        ) : null}
      </StepSection>

      {/* Payment step. Auto-revealed on the proposal surface; on the document surface it appears only
          after the contact-confirm above (so it's never shown as a locked placeholder there). */}
      {!requireConfirm || revealBank ? (
        <StepSection
          index="02"
          label={enableCard ? "Payment method" : "Bank account"}
          hint={
            enableCard
              ? undefined
              : "Find your bank to verify instantly, or enter your account details manually."
          }
          active={revealBank}
          divider
        >
          {revealBank ? (
            <AchPaymentForm
              init={init}
              returnUrl={returnUrl}
              name={fullName}
              email={email}
              canSubmit={detailsValid}
              submitLabel={submitLabel}
              enableCard={enableCard}
              onSettledPoll={onSettledPoll}
            />
          ) : (
            <LockedNote>Complete your details above to continue.</LockedNote>
          )}
        </StepSection>
      ) : null}
    </>
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
  hint?: string;
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
      {hint ? (
        <p className="mt-2 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase leading-[1.7] tracking-[0.12em]">
          {hint}
        </p>
      ) : null}
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
  onBlur,
  onFocus,
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
  onBlur?: () => void;
  onFocus?: () => void;
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
        onBlur={onBlur}
        onFocus={onFocus}
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
  returnUrl,
  name,
  email,
  canSubmit,
  submitLabel,
  enableCard,
  onSettledPoll,
}: {
  init: StagedAchInit;
  returnUrl: string;
  name: string;
  email: string;
  canSubmit: boolean;
  submitLabel: string;
  enableCard: boolean;
  onSettledPoll: (hint?: SettledHint) => void;
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
        returnUrl={returnUrl}
        name={name}
        email={email}
        canSubmit={canSubmit}
        submitLabel={submitLabel}
        enableCard={enableCard}
        onSettledPoll={onSettledPoll}
      />
    </Elements>
  );
}

type Phase = "idle" | "processing" | "succeeded";

function AchForm({
  returnUrl,
  name,
  email,
  canSubmit,
  submitLabel,
  enableCard,
  onSettledPoll,
}: {
  returnUrl: string;
  name: string;
  email: string;
  canSubmit: boolean;
  submitLabel: string;
  enableCard: boolean;
  onSettledPoll: (hint?: SettledHint) => void;
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
        return_url: returnUrl,
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
    // Card confirms synchronously → 'succeeded'; ACH (us_bank_account) returns 'processing' (settles in
    // 1-3 business days). The webhook is authoritative either way, but we hand the route an optimistic
    // hint so it can show the correct post-payment screen instantly (and not mislabel a card success as
    // ACH while the poll catches up). In this dual-rail intent the status uniquely identifies the rail:
    // succeeded ⇒ card, processing ⇒ us_bank_account. The poll then refines with the server's rail/date.
    const succeeded = result.paymentIntent?.status === "succeeded";
    setPhase(succeeded ? "succeeded" : "processing");
    setSubmitting(false);
    onSettledPoll(
      succeeded
        ? { status: "succeeded", rail: "card" }
        : { status: "processing", rail: "us_bank_account" },
    );
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
            options={{
              fields: { billingDetails: { name: "never", email: "never" } },
              // Dual-rail → Stripe's "Card | US bank account" tabs. ACH-only → default (single method,
              // no tab strip). `address`/`phone` stay at the implicit "auto" so the card tab can still
              // collect postal/ZIP for AVS while the bank tab renders nothing extra.
              layout: enableCard ? { type: "tabs" } : undefined,
              // Default-select the US bank account (ACH) tab — we prefer ACH. In a tabs layout the
              // LEADING entry of paymentMethodOrder renders selected on load; the server
              // payment_method_types order does NOT drive selection (absent this, Stripe applies its
              // own dynamic ordering). Listing `card` keeps it available as the second tab; harmless on
              // the ACH-only surface where `card` simply isn't present.
              paymentMethodOrder: ["us_bank_account", "card"],
              // Suppress the Stripe Link EXPRESS bar ("Secure, fast checkout with Link"). NOTE: this
              // flag does NOT remove the inline "Save my information for faster checkout" signup inside
              // the card form — that is account-level Link behavior, controlled by the account's
              // Payment Method Configuration (Stripe Dashboard → Settings → Payment methods → Link, or
              // the Payment Method Configurations API: link[display_preference][preference]=off), set
              // per Stripe mode. applePay/googlePay stay at the implicit "auto".
              wallets: { link: "never" },
            }}
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
        {submitting ? "Authorizing…" : submitLabel}
      </button>
      {/* Document (card-enabled) surface carries "Powered by Stripe" in the DocumentFrame footer band,
          so no caption here. The ACH-only proposal surface keeps its settlement caption. */}
      {!enableCard ? (
        <p className="text-center font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          US bank account · settles in 1–3 business days · powered by Stripe
        </p>
      ) : null}
    </form>
  );
}
