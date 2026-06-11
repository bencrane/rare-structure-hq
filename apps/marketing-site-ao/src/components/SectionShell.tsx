import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { SectionLabel } from "./SectionLabel";

interface SectionShellProps {
  /** Anchor id; also names the section landmark via aria-labelledby. */
  id?: string;
  /** Bracketed mono index, e.g. "II. Operating Protocol" or "Strategic Outcomes". */
  index: string;
  /** Serif display heading, rendered uppercase. */
  heading: string;
  children: ReactNode;
  className?: string;
}

/**
 * Standard content section: bracketed mono label → hairline rule → serif
 * heading → content. Owns the section divider (border-t) and page gutters.
 */
export function SectionShell({ id, index, heading, children, className }: SectionShellProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx(
        "scroll-mt-6 border-t border-[color:var(--color-border-subtle)] px-6 py-16 sm:px-12 sm:py-24",
        className,
      )}
    >
      <SectionLabel index={index} />
      <h2
        id={headingId}
        className="mt-8 font-display text-[2rem] font-semibold uppercase leading-[1.05] tracking-[-0.01em] text-[color:var(--color-text-primary)] sm:text-[2.5rem]"
      >
        {heading}
      </h2>
      <div className="mt-10 sm:mt-12">{children}</div>
    </section>
  );
}
