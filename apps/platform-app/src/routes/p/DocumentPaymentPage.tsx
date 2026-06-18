/**
 * DocumentPaymentPage — the ACH payment view at `/p/m/:opportunityId/:documentId/pay`.
 *
 * The step after signing in the direct-to-documenso flow (reached from DocumentSignedConfirmation's
 * "Continue to payment" CTA). It mints the ACH PaymentIntent via the BFF (amount resolved server-side
 * from `fee_amount` — never hardcoded) and hands off to the staged payment form. Keyed by the
 * (opportunity, document) PAIR, not a proposal ref.
 *
 * This route owns DATA + STATE only — minting/reusing the intent, the gate states (unsigned / paid /
 * unavailable), and the authoritative settled-status poll. The form geometry + Stripe Elements live in
 * `proposals/DocumentPaymentForm` (so the `no-route-geometry` lint stays satisfied). See that module
 * for the two-step progressive-disclosure structure and the Stripe billing-details split.
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; this page polls
 * `getDocumentPaymentState` for the settled status.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { DocumentPaymentForm, PaymentPill } from "@/proposals/DocumentPaymentForm";
import {
  type DocumentPaymentInit,
  PaymentError,
  createDocumentPaymentIntent,
  getDocumentPaymentState,
} from "@/proposals/api";

type PayState =
  | { kind: "loading" }
  | { kind: "ready"; init: DocumentPaymentInit }
  | { kind: "paid"; rail?: string | null }
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
        setPay({ kind: "paid", rail: existing.rail });
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
        setPay({ kind: "paid", rail: s.rail });
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
  if (pay.kind === "loading") {
    note = <Note>Preparing payment…</Note>;
  } else if (!opportunityId || !documentId) {
    note = <Note>This payment link is invalid or has expired.</Note>;
  } else if (pay.kind === "paid") {
    const byRail =
      pay.rail === "card"
        ? "Payment received by card"
        : pay.rail === "us_bank_account"
          ? "Payment received by bank transfer"
          : "Payment received";
    note = <Note>{byRail} — this engagement is active.</Note>;
  } else if (pay.kind === "unsigned") {
    note = (
      <Note>Sign the engagement agreement before payment. Return to the document to continue.</Note>
    );
  } else if (pay.kind === "unavailable") {
    note = <Note>Payment is temporarily unavailable. Please try again shortly.</Note>;
  }

  return (
    <DocumentFrame
      title="Engagement Payment"
      headerAccessory={<PaymentPill paid={pay.kind === "paid"} />}
      hideTrustStrip
      backHref={opportunityId && documentId ? `/p/m/${opportunityId}/${documentId}` : undefined}
      maxWidthClass="max-w-[920px]"
    >
      {pay.kind === "ready" && opportunityId && documentId ? (
        <DocumentPaymentForm
          init={pay.init}
          opportunityId={opportunityId}
          documentId={documentId}
          onSettledPoll={startPolling}
        />
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
