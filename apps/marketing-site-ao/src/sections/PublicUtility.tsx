import { SectionShell, leadText } from "../components/SectionShell";
import { StatusDot } from "../components/StatusDot";
import { publicUtility } from "../data/site";

export function PublicUtility() {
  const { body, ctaLabel, ctaHref, accessNote, panel } = publicUtility;
  const { sample } = panel;

  return (
    <SectionShell
      id="public-utility"
      index="Maintained Resources"
      heading="Your Federal Standing"
      layout="split"
      lead={body[0]}
      aside={
        // Illustrative entity profile — decorative specimen of the dashboard.
        <div
          className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] p-6 sm:p-7"
          aria-hidden="true"
        >
          <p className="font-display text-[1.0625rem] font-semibold leading-tight text-[color:var(--color-text-primary)]">
            {sample.name}
          </p>
          <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
            {sample.meta}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {sample.badges.map((badge, i) => (
              <span
                key={badge}
                className={`inline-flex items-center gap-1.5 border border-[color:var(--color-border-default)] px-2 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.12em] ${
                  i === 0
                    ? "text-[color:var(--color-state-success)]"
                    : "text-[color:var(--color-text-muted)]"
                }`}
              >
                {i === 0 ? <StatusDot tone="success" /> : null}
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 border border-[color:var(--color-border-default)]">
            {sample.stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`px-3 py-3 ${i > 0 ? "border-l border-[color:var(--color-border-subtle)]" : ""}`}
              >
                <p className="font-display text-[1.125rem] font-semibold leading-none text-[color:var(--color-text-primary)]">
                  {stat.value}
                </p>
                <p className="mt-2 font-mono text-[0.5625rem] uppercase leading-[1.4] tracking-[0.1em] text-[color:var(--color-text-subtle)]">
                  {stat.label}
                </p>
                {stat.sub ? (
                  <p className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                    {stat.sub}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
            {sample.agenciesLabel}
          </p>
          <div className="mt-3 space-y-3">
            {sample.agencies.map((agency) => (
              <div key={agency.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.8125rem] leading-tight text-[color:var(--color-text-default)]">
                    {agency.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[0.6875rem] tabular-nums">
                    <span className="text-[color:var(--color-text-default)]">{agency.value}</span>
                    <span className="ml-2 text-[color:var(--color-text-subtle)]">
                      {agency.pct}%
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full bg-[color:var(--color-border-subtle)]">
                  <div
                    className="h-full bg-[color:var(--color-text-accent)]"
                    style={{ width: `${agency.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
            {panel.sourceLine}
          </p>
        </div>
      }
    >
      <p className={leadText}>
        Look up your entity at{" "}
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--color-text-accent)] underline decoration-[color:var(--color-border-strong)] underline-offset-4 transition-colors hover:text-[color:var(--color-text-primary)] hover:decoration-[color:var(--color-text-primary)]"
        >
          {ctaLabel}
        </a>
        . {accessNote}
      </p>
    </SectionShell>
  );
}
