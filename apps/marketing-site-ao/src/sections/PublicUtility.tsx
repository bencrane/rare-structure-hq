import { Eyebrow } from "../components/Eyebrow";
import { SectionShell } from "../components/SectionShell";
import { CheckIcon, SealIcon } from "../components/icons";
import { publicUtility } from "../data/site";

export function PublicUtility() {
  const { body, ctaLabel, ctaHref, panel } = publicUtility;

  return (
    <SectionShell
      id="public-utility"
      index="Maintained Resources"
      heading="Your Federal Standing"
      layout="split"
      aside={
        <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <Eyebrow label={panel.kicker} tone="subtle" />
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[color:var(--color-state-success)]">
              Live
            </span>
          </div>

          <div className="mt-6 flex items-center gap-2.5 text-[color:var(--color-text-primary)]">
            <SealIcon className="shrink-0 text-[color:var(--color-text-accent)]" />
            <span className="font-display text-[1.0625rem] font-semibold tracking-[0.01em]">
              {panel.wordmark}
            </span>
          </div>
          <p className="mt-2.5 text-[0.8125rem] leading-[1.5] text-[color:var(--color-text-muted)]">
            {panel.descriptor}
          </p>

          <div className="mt-6 h-px w-full bg-[color:var(--color-border-subtle)]" />
          <ul className="mt-5 space-y-2.5">
            {panel.capabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-center gap-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-[color:var(--color-text-default)]"
              >
                <CheckIcon className="shrink-0 text-[color:var(--color-text-accent)]" />
                <span>{cap}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]">
            {panel.sourceLine}
          </p>
        </div>
      }
    >
      <p className="mt-5 max-w-[34rem] text-[0.9375rem] leading-[1.7] text-[color:var(--color-text-muted)]">
        {body[0]}
      </p>
      <p className="mt-6 max-w-[34rem] text-[0.9375rem] leading-[1.7] text-[color:var(--color-text-muted)]">
        Look up your entity at{" "}
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--color-text-accent)] underline decoration-[color:var(--color-border-strong)] underline-offset-4 transition-colors hover:text-[color:var(--color-text-primary)] hover:decoration-[color:var(--color-text-primary)]"
        >
          {ctaLabel}
        </a>
        .
      </p>
    </SectionShell>
  );
}
