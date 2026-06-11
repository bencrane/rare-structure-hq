/**
 * ProposalViewerShell — the framed "proposal viewer" chrome shared by the executive summary
 * (`/p/:ref`) and the signing view (`/p/:ref/sign`), so the two read as one continuous surface.
 *
 * Structure (identical on both pages — only the body and a few props change):
 *   utility bar (app chrome)  →  framed card { letterhead-grade header · body · trust-strip footer }
 *
 * Lives in `proposals/` (not `routes/`) deliberately: it owns page geometry on behalf of the
 * route components, which keeps the `no-route-geometry` lint where it belongs (the routes stay
 * content-only and just drop their body into this shell).
 */
import type { ProposalShell } from "@rare-structure-hq/shared";
import { Link } from "react-router-dom";

export function ProposalViewerShell({
  title,
  status,
  backHref,
  maxWidthClass = "max-w-[768px]",
  headerAccessory,
  housing = "standalone",
  children,
}: {
  /** Document identity shown in the card header — e.g. "Engagement Proposal" / "Engagement Agreement". */
  title: string;
  status?: ProposalShell["status"];
  /** When set, the utility bar's left slot is a "← Back to summary" link; otherwise the brand tagline. */
  backHref?: string;
  /** Card width — narrow for the reading summary, wide for the two-column signing embed. */
  maxWidthClass?: string;
  /** Top-right header slot. Replaces the default StatusPill (e.g. the operator's draft controls). */
  headerAccessory?: React.ReactNode;
  /**
   * Where the shell is mounted. `"standalone"` (default) is the public proposal surface
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
        {backHref ? (
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

      {/* Framed viewer — same border / surface / shadow on both pages. */}
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

          {/* Footer — trust strip, identical across both pages. */}
          <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-raised)] px-6 py-3">
            <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Legally binding e-signature
            </span>
            <span className="font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Audit trail preserved
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small mono status chip — mirrors the proposal lifecycle on the viewer header.
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
