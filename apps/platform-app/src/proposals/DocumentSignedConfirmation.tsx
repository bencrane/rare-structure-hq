/**
 * DocumentSignedConfirmation — the direct-to-documenso post-sign view, rendered IN PLACE within
 * DocumentSignPage's DocumentFrame once the server poll confirms the envelope is signed.
 *
 * Built first-principles for THIS flow: no docraptor/proposal post-sign components, no proposal
 * `ref` (this flow is keyed by the envelope id alone). Deliberately minimal — the operator's bar is
 * "a page LOADS on signing." A clear confirmation headline + one reassurance line, on-theme via the
 * shared surface/accent tokens.
 *
 * Lives in `proposals/` (alongside DocumentPaymentForm) deliberately: it owns the confirmation-body
 * geometry on behalf of the route, which keeps the `no-route-geometry` lint where it belongs (the
 * route stays content/state-only).
 *
 * PHASE 2b: the payment CTA advances signed → pay. The direct-to-documenso flow keys payment on the
 * `(opportunityId, documentId)` PAIR the signing link already carries (mirroring the route shape
 * `/p/m/:opportunityId/:documentId`), not a proposal `ref`. The "Continue to payment" action below
 * points at `/p/m/:opportunityId/:documentId/pay`.
 */
import { Link } from "react-router-dom";

export function DocumentSignedConfirmation({
  opportunityId,
  documentId,
}: {
  opportunityId: string;
  documentId: string;
}) {
  return (
    <div className="flex min-h-[78vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]">
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
      </div>
      <h2 className="mt-6 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        Agreement signed
      </h2>
      <p className="mt-4 max-w-[440px] font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] leading-relaxed tracking-[0.06em]">
        Your engagement agreement has been signed and recorded. A fully executed copy will be sent
        to your email upon payment completion.
      </p>
      {/* PHASE 2b — payment handoff, keyed by the (opportunityId, documentId) pair. */}
      <Link
        to={`/p/m/${opportunityId}/${documentId}/pay`}
        className="mt-8 inline-block border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-3 font-mono text-[0.75rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
      >
        Continue to payment →
      </Link>
    </div>
  );
}
