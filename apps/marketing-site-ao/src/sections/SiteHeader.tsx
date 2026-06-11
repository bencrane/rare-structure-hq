import { StatusDot } from "../components/StatusDot";

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-[color:var(--color-border-subtle)] px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-12 sm:py-6">
      <div>
        <p className="font-display text-[1.0625rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--color-text-primary)]">
          Active Operators
        </p>
        <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
          {"Private Routing Protocol // Federal & Commercial Compliance"}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] sm:justify-end">
          <StatusDot tone="success" pulse />
          System Active
        </p>
        <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
          Secure Routing Enabled
        </p>
      </div>
    </header>
  );
}
