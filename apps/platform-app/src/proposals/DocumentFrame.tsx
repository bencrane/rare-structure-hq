/**
 * DocumentFrame — the shared letterhead chrome every mandate surface renders inside, so the
 * operator editor (`/app/m/:ref`), the prospect summary (`/p/:ref`), the signing view
 * (`/p/:ref/sign`), and the payment view (`/p/:ref/pay`) all read as one continuous document.
 *
 * Content-agnostic — it owns page geometry only (identical everywhere; only the body + a few
 * props change):
 *   utility bar (app chrome)  →  framed card { letterhead-grade header · body · trust-strip footer }
 * Each surface drops its own body into `children` and sets a few props (title · width · backHref).
 *
 * Lives in `proposals/` (not `routes/`) deliberately: it owns page geometry on behalf of the
 * route components, which keeps the `no-route-geometry` lint where it belongs (the routes stay
 * content-only and just drop their body into this frame).
 */
import type { ProposalShell } from "@rare-structure-hq/shared";
import { Link } from "react-router-dom";

export function DocumentFrame({
  title,
  status,
  backHref,
  onBack,
  maxWidthClass = "max-w-[768px]",
  headerAccessory,
  hideTrustStrip = false,
  footer,
  housing = "standalone",
  children,
}: {
  /** Document identity shown in the card header — e.g. "Engagement Proposal" / "Engagement Agreement". */
  title: string;
  status?: ProposalShell["status"];
  /** When set, the utility bar's left slot is a "← Back to summary" link to another ROUTE; otherwise
   * the brand tagline. Use for cross-route back nav (e.g. the pay page → the summary route). */
  backHref?: string;
  /** In-page back handler — takes precedence over `backHref`. Use when "back" is a state change on the
   * SAME route, not a navigation (e.g. the sign page returning from the Documenso embed to its summary
   * scaffold, where a `<Link>` to the current URL would be a no-op). Renders a button, not a link. */
  onBack?: () => void;
  /** Card width — narrow for the reading summary, wide for the two-column signing embed. */
  maxWidthClass?: string;
  /** Top-right header slot. Replaces the default StatusPill (e.g. the operator's draft controls). */
  headerAccessory?: React.ReactNode;
  /** Suppress the trust-strip TEXT ("Legally binding e-signature" / "Audit trail preserved") while
   * KEEPING the footer band. The payment surface sets this — those claims are about signing, not the
   * ACH debit — but the band itself stays as the framed document's bottom edge. */
  hideTrustStrip?: boolean;
  /** Custom footer-band text (left/right), overriding both the default trust strip and the empty
   * `hideTrustStrip` band. The payment surface uses it for "Secure transaction" / "Powered by Stripe". */
  footer?: { left: string; right: string };
  /**
   * Where the frame is mounted. `"standalone"` (default) is the public proposal surface
   * (`/p/:ref` and its sign/pay steps) — the utility bar keeps its own `py-4` band. `"cockpit"`
   * is the operator's Mandate page (`/app/m/:ref`), housed inside AppShell: the utility bar
   * adopts the sidebar header's fixed `min-h-16` band so the two dividers sit on one plane.
   */
  housing?: "standalone" | "cockpit";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-surface-base)]">
      {/* Utility bar — persistent app chrome, PINNED to the top so it never scrolls away (the bare
          band that left behind looked broken). Opaque surface + z-index so the card scrolls cleanly
          beneath it. Standalone (public `/p/:ref`) keeps its own `py-4` band; in the cockpit it
          adopts the sidebar header's fixed `min-h-16` band so the bottom border lands on the same
          horizontal plane as the sidebar divider (`/app/m/:ref`). */}
      <div
        className={`sticky top-0 z-30 flex items-center justify-between border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-base)] px-6 ${
          housing === "cockpit" ? "min-h-16" : "py-4"
        }`}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.16em] transition-colors hover:text-[color:var(--color-text-accent)]"
          >
            ← Back to summary
          </button>
        ) : backHref ? (
          <Link
            to={backHref}
            className="font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.16em] transition-colors hover:text-[color:var(--color-text-accent)]"
          >
            ← Back to summary
          </Link>
        ) : (
          <span className="font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em]">
            Catalyst-Driven Origination
          </span>
        )}
        <div className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Strategic Origination Mandate
        </div>
      </div>

      {/* Framed document — same border / surface / shadow on every surface. */}
      <div className="flex flex-1 items-start justify-center px-4 py-6 md:px-8 md:py-10">
        <div
          className={`flex w-full ${maxWidthClass} flex-col overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] shadow-[0_24px_64px_-32px_rgba(0,0,0,0.8)]`}
        >
          {/* Header — document identity (letterhead-grade). */}
          <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-raised)] px-6 py-4">
            <div className="font-display font-semibold text-[0.8125rem] text-[color:var(--color-text-primary)] uppercase tracking-[0.16em]">
              {title}
            </div>
            {headerAccessory ?? <StatusPill status={status} />}
          </div>

          {/* Body — page-specific (summary content, or the signing embed). */}
          <div className="relative flex-1 bg-[color:var(--color-surface-base)]">{children}</div>

          {/* Footer band — the framed document's bottom edge (letterhead rhythm). `footer` sets custom
              left/right text (payment uses "Secure transaction" / "Powered by Stripe"); else signing
              surfaces fill it with the trust strip; else `hideTrustStrip` keeps the band but empty. */}
          <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-raised)] px-6 py-3">
            {footer ? (
              <>
                <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
                  {footer.left}
                </span>
                <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
                  {footer.right}
                </span>
              </>
            ) : hideTrustStrip ? (
              // Empty band — a non-breaking space holds the same line box as the trust-strip text, so
              // the band's height matches the signing surfaces exactly.
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em]">
                {"\u00A0"}
              </span>
            ) : (
              <>
                <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
                  Legally binding e-signature
                </span>
                <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
                  Audit trail preserved
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small mono status chip — mirrors the proposal lifecycle on the frame header.
function StatusPill({ status }: { status?: ProposalShell["status"] }) {
  const executed = status === "signed" || status === "paid";
  const label =
    status === "paid" ? "Executed" : status === "signed" ? "Signed" : "Awaiting signature";
  const tone = executed
    ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
    : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)]";
  return (
    <span
      className={`shrink-0 border px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] ${tone}`}
    >
      {label}
    </span>
  );
}
