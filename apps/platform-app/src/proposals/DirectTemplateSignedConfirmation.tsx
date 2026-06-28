/**
 * DirectTemplateSignedConfirmation — the direct-TEMPLATE post-sign view, rendered IN PLACE within
 * DirectTemplateSignPage's DocumentFrame once the server poll confirms the document is signed.
 *
 * The embed-template ANALOG of `DocumentSignedConfirmation` (the prefill-document lane's post-sign
 * view). Deliberately SIMPLER than that one: this lane mints no document up front and has no payment
 * handoff, so there is no "Continue to payment" CTA — the bar for this surface is "a clean
 * confirmation loads on signing." A confirmation headline + one reassurance line, on-theme via the
 * shared surface/accent tokens.
 *
 * Lives in `proposals/` (alongside DocumentSignedConfirmation) deliberately: it owns the
 * confirmation-body geometry on behalf of the route, which keeps the `no-route-geometry` lint where
 * it belongs (the route stays content/state-only).
 */
export function DirectTemplateSignedConfirmation() {
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
      <h2 className="mt-6 font-mono text-[1.25rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
        Agreement signed
      </h2>
      <p className="mt-4 max-w-[480px] font-mono text-[0.875rem] text-[color:var(--color-text-muted)] leading-relaxed tracking-[0.06em]">
        Your engagement agreement has been signed and recorded. A fully executed copy will be sent
        to your email.
      </p>
    </div>
  );
}
