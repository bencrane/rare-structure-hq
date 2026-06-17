/**
 * StripePaymentSection — the ACH (us_bank_account) payment surface for `/p/:ref/pay`.
 *
 * Card is never offered: the PaymentIntent is created server-side (edge_api) with
 * `payment_method_types=['us_bank_account']`, so the bank-account collection renders only.
 *
 * This is a thin wrapper over the shared `StagedAchForm` — the SAME staged body the direct-to-documenso
 * surface uses — so the two ACH surfaces cannot drift in billing-collection behavior. Billing details
 * (name + email) are split OUT of Stripe's iframe into our own native "Your details" step and supplied
 * at `confirmPayment` via `payment_method_data.billing_details`; for `us_bank_account` both are required
 * PaymentMethod fields, so the native inputs gate submit. The known `clientName` seeds the name input.
 * The amount header for this surface is owned by `PaymentPage` (the route), so only the staged body
 * lives here.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; the page polls `getPaymentState`
 * for the settled status.
 */
import type { PaymentInit } from "@rare-structure-hq/shared";

import { StagedAchForm, formatUsdCents } from "./StagedAchForm";

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
  return (
    <StagedAchForm
      init={init}
      returnUrl={`${window.location.origin}/p/${proposalRef}/pay?status=submitted`}
      nameDefault={clientName}
      submitLabel={`Authorize ACH debit · ${formatUsdCents(init.amountCents, init.currency)}`}
      onSettledPoll={onSettledPoll}
    />
  );
}
