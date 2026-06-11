import { StatusDot } from "../components/StatusDot";
import { footerColumns } from "../data/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--color-border-subtle)] px-6 py-14 sm:px-12">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="max-w-[28rem]">
          <p className="font-display text-[1.0625rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--color-text-primary)]">
            Active Operators
          </p>
          <p className="mt-4 text-[0.875rem] leading-[1.65] text-[color:var(--color-text-muted)]">
            A private syndicate of specialized infrastructure, service, legal, and capital providers
            explicitly supporting the federal and commercial contracting markets during critical
            operational inflection points.
          </p>
          <p className="mt-6 flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
            <StatusDot tone="success" />
            Secure Routing Network Enabled
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-default)]">
                {column.heading}
              </p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-accent)] focus-visible:text-[color:var(--color-text-accent)] focus-visible:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--color-border-subtle)] pt-6 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)] sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Active Operators Syndicate. All Rights Reserved.</span>
        <span>Confidential / Proprietary Routing</span>
      </div>
    </footer>
  );
}
