import { Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/briefings", label: "Briefings" },
  { to: "/firm", label: "Firm" },
] as const;

export function SiteHeader() {
  const { pathname } = useLocation();
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-overlay)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3 sm:px-10">
        <Link
          to="/"
          className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-primary)] transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          Rare Structure
        </Link>
        <nav className="flex items-center gap-6">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`font-mono text-[0.625rem] uppercase tracking-[0.2em] transition-colors ${
                pathname.startsWith(item.to)
                  ? "text-[color:var(--color-text-accent)]"
                  : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
