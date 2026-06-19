export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--color-border-subtle)] px-6 py-14 sm:px-12">
      <div className="max-w-[28rem]">
        <p className="font-display text-[1.0625rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--color-text-primary)]">
          Active Operators
        </p>
        <p className="mt-4 text-[0.875rem] leading-[1.65] text-[color:var(--color-text-muted)]">
          A private syndicate of specialized infrastructure, service, legal, and capital providers
          explicitly supporting the federal and commercial contracting markets during critical
          operational inflection points.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--color-border-subtle)] pt-6 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)] sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Active Operators Syndicate. All Rights Reserved.</span>
        <span>Confidential / Proprietary Routing</span>
      </div>
    </footer>
  );
}
