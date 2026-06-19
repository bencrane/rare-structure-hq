import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { Eyebrow } from "./Eyebrow";

type SectionLayout = "stack" | "split";

interface SectionShellProps {
  /** Anchor id; also names the section landmark via aria-labelledby. */
  id?: string;
  /** Bracketed mono index, e.g. "Operating Protocol" or "Strategic Outcomes". */
  index: string;
  /** Serif display heading, rendered uppercase. */
  heading: string;
  /** Optional lead paragraph under the heading. One uniform tone + scale site-wide. */
  lead?: ReactNode;
  /** Right-column content when layout="split" (panel / form / card). */
  aside?: ReactNode;
  /** "stack" (default) = full-width content; "split" = heading/lead left, aside right. */
  layout?: SectionLayout;
  children?: ReactNode;
  className?: string;
}

/** Canonical heading ramp — the ONLY place a section <h2> is defined. */
const headingClass =
  "font-display text-[1.75rem] font-semibold uppercase leading-[1.05] tracking-[-0.01em] text-[color:var(--color-text-primary)] sm:text-[2.25rem]";
/** Canonical section lead — the ONLY intro-paragraph scale/tone. */
const leadClass =
  "mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.55] text-[color:var(--color-text-muted)]";

/**
 * Standard content section: bracketed mono label → hairline rule → serif
 * heading → content. Owns the section divider (border-t), page gutters, the
 * heading ramp, and — for layout="split" — the two-column text/aside grid and
 * its alignment rule (left column top-aligned, no manufactured voids).
 *
 * This is the single legal way to render a content section. Do not hand-roll
 * the label/heading/gutters in a section file; pass `aside` for a side panel.
 */
export function SectionShell({
  id,
  index,
  heading,
  lead,
  aside,
  layout = "stack",
  children,
  className,
}: SectionShellProps) {
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
      <Eyebrow label={index} tone="accent" />

      {layout === "split" ? (
        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 id={headingId} className={headingClass}>
              {heading}
            </h2>
            {lead ? <p className={leadClass}>{lead}</p> : null}
            {children}
          </div>
          <div>{aside}</div>
        </div>
      ) : (
        <>
          <h2 id={headingId} className={cx("mt-8", headingClass)}>
            {heading}
          </h2>
          {lead ? <p className={leadClass}>{lead}</p> : null}
          <div className="mt-10 sm:mt-12">{children}</div>
        </>
      )}
    </section>
  );
}
