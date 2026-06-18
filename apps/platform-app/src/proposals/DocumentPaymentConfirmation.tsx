/**
 * DocumentPaymentConfirmation — the direct-to-documenso post-PAYMENT screen, rendered IN PLACE within
 * DocumentPaymentPage's DocumentFrame once the authoritative (webhook-driven) state reports the debit
 * is settling or settled. The signing-flow counterpart is DocumentSignedConfirmation; this mirrors its
 * structure (centered column, accent-ring icon, mono headline, muted reassurance, on-theme tokens).
 *
 * Three modes, branched on the polled state — SERVER TRUTH (the `business.document_payments` row the
 * Stripe webhook advances), never the browser confirm result:
 *   - card succeeded       → "Payment received"   (instant rail; engagement active)
 *   - ACH/other succeeded  → "Payment received"   (funds settled)
 *   - ACH processing       → "Payment initiated"  (authorized; settles in 1–3 business days)
 *
 * Lives in `proposals/` (not `routes/`) deliberately: it owns confirmation-body geometry on behalf of
 * the route, keeping the `no-route-geometry` lint where it belongs (the route stays state-only).
 *
 * The success copy promises a MANUAL follow-up email from the team (onboarding + a copy of the signed
 * agreement); no automated receipt/email is sent by the system.
 */
import { formatUsdCents } from "./StagedAchForm";

export function DocumentPaymentConfirmation({
  status,
  rail,
  amountCents,
  currency = "usd",
}: {
  status: "succeeded" | "processing";
  /** Settled rail ("card" | "us_bank_account"); null until settlement or if the rail read failed. */
  rail?: string | null;
  amountCents?: number | null;
  currency?: string;
  /** ISO-8601, set only on `succeeded`; null while processing. Accepted but no longer displayed. */
  paidAt?: string | null;
}) {
  const settled = status === "succeeded";
  const railLabel =
    rail === "card" ? "Card" : rail === "us_bank_account" ? "Bank transfer (ACH)" : null;

  const reassurance = settled
    ? "We have received your payment. You will receive an email shortly from a member of our team with onboarding information and a copy of your signed agreement. You may exit this page now."
    : "Your bank debit is authorized. ACH transfers settle in 1–3 business days; your engagement activates on settlement — you can safely close this page.";

  // Meta row: hidden once settled (the message above is self-contained — no rail/date line); while the
  // ACH debit clears it shows the rail + "Awaiting settlement".
  const metaParts = settled ? [] : [railLabel ?? "Bank transfer (ACH)", "Awaiting settlement"];

  return (
    <div className="flex min-h-[78vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]">
        {settled ? <CheckIcon /> : <ClockIcon />}
      </div>
      <h2 className="mt-6 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        {settled ? "Payment received" : "Payment initiated"}
      </h2>
      {typeof amountCents === "number" && amountCents > 0 ? (
        <div className="mt-4 text-[1.75rem] text-[color:var(--color-text-primary)] tabular-nums">
          {formatUsdCents(amountCents, currency)}
        </div>
      ) : null}
      <p className="mt-4 max-w-[440px] font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] leading-relaxed tracking-[0.06em]">
        {reassurance}
      </p>
      {metaParts.length > 0 ? (
        <div className="mt-6 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em] tabular-nums">
          {metaParts.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
