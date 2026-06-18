/**
 * DocumentPaymentForm — the payment body for the direct-to-documenso engagement fee, rendered inside
 * DocumentPaymentPage's DocumentFrame at `/p/m/:opportunityId/:documentId/pay`.
 *
 * Thin wrapper: it owns this surface's amount header + page padding, then drops the shared
 * `StagedAchForm` (Step 01 "Your details" → Step 02 "Payment method", the Stripe billing-details split)
 * into the frame. This surface passes `enableCard` — the minted intent is dual-rail, so the
 * PaymentElement offers a "Card | US bank account" two-choice (card settles instantly; ACH async). The
 * staged body is shared with the proposal-ref surface (`StripePaymentSection`, ACH-only) so the two
 * surfaces cannot drift in billing-collection behavior — see `StagedAchForm` for the
 * progressive-disclosure structure, the latched reveal, and the billing-fields split (which the
 * dual-method intent's union of requirements keeps mandatory).
 *
 * Lives in `proposals/` (alongside StripePaymentSection) deliberately: it owns form geometry on behalf
 * of the route, which keeps the `no-route-geometry` lint where it belongs (the route stays
 * content/state-only).
 *
 * Card captures synchronously (`confirmPayment` → `succeeded`); ACH returns `processing` and settles
 * 1–3 business days later. The authoritative "paid" transition arrives via the Stripe webhook →
 * edge_api; the route polls `getDocumentPaymentState` for the settled status (via `onSettledPoll`).
 */
import { type SettledHint, StagedAchForm, formatUsdCents } from "./StagedAchForm";
import type { DocumentPaymentInit } from "./api";

export function DocumentPaymentForm({
  init,
  opportunityId,
  documentId,
  onSettledPoll,
}: {
  init: DocumentPaymentInit;
  opportunityId: string;
  documentId: string;
  onSettledPoll: (hint?: SettledHint) => void;
}) {
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

      <StagedAchForm
        init={init}
        returnUrl={`${window.location.origin}/p/m/${opportunityId}/${documentId}/pay?status=submitted`}
        submitLabel="Authorize payment"
        nameDefault={init.contactName ?? ""}
        emailDefault={init.contactEmail ?? ""}
        requireConfirm
        enableCard
        onSettledPoll={onSettledPoll}
      />
    </div>
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
