/**
 * DocumentPaymentPage — the ACH payment view at `/p/m/:opportunityId/:documentId/pay`.
 *
 * The step after signing in the direct-to-documenso flow (reached from DocumentSignedConfirmation's
 * "Continue to payment" CTA). It mints the ACH PaymentIntent via the BFF (amount resolved server-side
 * from `fee_amount` — never hardcoded) and hands off to the staged payment form. Keyed by the
 * (opportunity, document) PAIR, not a proposal ref.
 *
 * This route owns DATA + STATE only — minting/reusing the intent, the gate states (unsigned /
 * succeeded / processing / unavailable), and the authoritative settled-status poll. The form geometry +
 * Stripe Elements live in `proposals/DocumentPaymentForm`, and the post-payment screen in
 * `proposals/DocumentPaymentConfirmation` (so the `no-route-geometry` lint stays satisfied).
 *
 * ACH settles asynchronously: `confirmPayment` returns `processing`, NOT `succeeded`. The authoritative
 * "paid" transition arrives later via the Stripe webhook → edge_api; this page polls
 * `getDocumentPaymentState` for the settled status and reflects it with DocumentPaymentConfirmation.
 * A prospect who authorizes an ACH debit and returns later (state already `processing`) lands straight
 * on the in-frame confirmation screen with the poll re-armed — not the form again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { DocumentFrame } from "@/proposals/DocumentFrame";
import { DocumentPaymentConfirmation } from "@/proposals/DocumentPaymentConfirmation";
import { DocumentPaymentForm, PaymentPill } from "@/proposals/DocumentPaymentForm";
import type { SettledHint } from "@/proposals/StagedAchForm";
import {
  type DocumentPaymentInit,
  PaymentError,
  createDocumentPaymentIntent,
  getDocumentPaymentState,
} from "@/proposals/api";

type PayState =
  | { kind: "loading" }
  | { kind: "ready"; init: DocumentPaymentInit }
  | {
      kind: "succeeded";
      rail?: string | null;
      amountCents?: number | null;
      currency?: string;
      paidAt?: string | null;
    }
  | { kind: "processing"; rail?: string | null; amountCents?: number | null; currency?: string }
  | { kind: "unsigned" }
  | { kind: "unavailable" };

export default function DocumentPaymentPage() {
  const { opportunityId, documentId } = useParams<{
    opportunityId: string;
    documentId: string;
  }>();
  const [pay, setPay] = useState<PayState>({ kind: "loading" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Poll the authoritative (webhook-driven) state until it reaches a terminal status. Armed after the
  // client authorizes the debit AND on mount when the pair is already `processing` (return-mid-ACH).
  // SERVER TRUTH only — the browser confirm result never advances the page.
  const startPolling = useCallback(() => {
    if (!opportunityId || !documentId || pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      const s = await getDocumentPaymentState(opportunityId, documentId).catch(() => null);
      if (!s) return;
      if (s.paymentStatus === "succeeded") {
        setPay({
          kind: "succeeded",
          rail: s.rail,
          amountCents: s.amountCents,
          currency: s.currency,
          paidAt: s.paidAt,
        });
        stopPolling();
      } else if (s.paymentStatus === "failed" || s.paymentStatus === "canceled") {
        // Terminal failure — stop polling so the screen can't spin "Payment initiated" forever.
        setPay({ kind: "unavailable" });
        stopPolling();
      } else if (s.paymentStatus === "processing") {
        // Keep the in-flight confirmation up; functional update avoids a churn re-render each tick.
        setPay((prev) =>
          prev.kind === "processing"
            ? prev
            : {
                kind: "processing",
                rail: s.rail,
                amountCents: s.amountCents,
                currency: s.currency,
              },
        );
      }
    }, 5000);
  }, [opportunityId, documentId, stopPolling]);

  // Mint (or reuse) the intent once the pair is known. Short-circuit to the confirmation screen when
  // the pair is already settled (succeeded) or in-flight (processing — re-arm the poll); otherwise mint.
  useEffect(() => {
    if (!opportunityId || !documentId) return;
    let active = true;
    (async () => {
      const existing = await getDocumentPaymentState(opportunityId, documentId).catch(() => null);
      if (!active) return;
      if (existing?.paymentStatus === "succeeded") {
        setPay({
          kind: "succeeded",
          rail: existing.rail,
          amountCents: existing.amountCents,
          currency: existing.currency,
          paidAt: existing.paidAt,
        });
        return;
      }
      if (existing?.paymentStatus === "processing") {
        setPay({
          kind: "processing",
          rail: existing.rail,
          amountCents: existing.amountCents,
          currency: existing.currency,
        });
        startPolling();
        return;
      }
      try {
        const init = await createDocumentPaymentIntent(opportunityId, documentId);
        if (active) setPay({ kind: "ready", init });
      } catch (e) {
        if (!active) return;
        if (e instanceof PaymentError && e.status === 409) {
          // 409 = "agreement not yet signed" (the common gate). An "already paid" race resolves via
          // the state read; treat the gate as "sign first".
          setPay(/already paid/i.test(e.message) ? { kind: "succeeded" } : { kind: "unsigned" });
        } else {
          setPay({ kind: "unavailable" });
        }
      }
    })();
    return () => {
      active = false;
      stopPolling();
    };
  }, [opportunityId, documentId, startPolling, stopPolling]);

  // Clear any live poll on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  // Bridge from the in-form confirm result: show the correct post-payment screen IMMEDIATELY (card →
  // succeeded, ACH → processing), carrying the amount already known from the minted intent so it never
  // blinks out, then arm the poll to refine with server truth (authoritative rail + settled date).
  const handleSettled = useCallback(
    (hint?: SettledHint) => {
      if (hint) {
        setPay((prev) => {
          const amountCents =
            prev.kind === "ready"
              ? prev.init.amountCents
              : prev.kind === "succeeded" || prev.kind === "processing"
                ? prev.amountCents
                : null;
          const currency =
            prev.kind === "ready"
              ? prev.init.currency
              : prev.kind === "succeeded" || prev.kind === "processing"
                ? prev.currency
                : undefined;
          return hint.status === "succeeded"
            ? { kind: "succeeded", rail: hint.rail, amountCents, currency, paidAt: null }
            : { kind: "processing", rail: hint.rail, amountCents, currency };
        });
      }
      startPolling();
    },
    [startPolling],
  );

  let note: React.ReactNode = null;
  if (pay.kind === "loading") {
    note = <Note>Preparing payment…</Note>;
  } else if (!opportunityId || !documentId) {
    note = <Note>This payment link is invalid or has expired.</Note>;
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
      headerAccessory={<PaymentPill paid={pay.kind === "succeeded"} />}
      footer={{ left: "Secure transaction", right: "Powered by Stripe" }}
      backHref={opportunityId && documentId ? `/p/m/${opportunityId}/${documentId}` : undefined}
      maxWidthClass="max-w-[920px]"
    >
      {pay.kind === "ready" && opportunityId && documentId ? (
        <DocumentPaymentForm
          init={pay.init}
          opportunityId={opportunityId}
          documentId={documentId}
          onSettledPoll={handleSettled}
        />
      ) : pay.kind === "succeeded" || pay.kind === "processing" ? (
        <DocumentPaymentConfirmation
          status={pay.kind}
          rail={pay.rail}
          amountCents={pay.amountCents}
          currency={pay.currency}
          paidAt={pay.kind === "succeeded" ? pay.paidAt : null}
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
