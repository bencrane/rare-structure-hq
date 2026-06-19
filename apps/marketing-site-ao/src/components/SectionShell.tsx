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
  /** Optional lead paragraph(s) under the heading. Pass an array for multiple paragraphs. */
  lead?: string | string[];
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
/** Canonical section lead — the ONLY intro-paragraph scale/tone. Exported so a
 *  split section can style its bottom-pinned trailing paragraph to match. */
export const leadText = "text-[1.0625rem] leading-[1.55] text-[color:var(--color-text-muted)]";

/**
 * Standard content section: bracketed mono label → hairline rule → serif
 * heading → content. Owns the section divider (border-t), page gutters, and the
 * heading ramp.
 *
 * - layout="stack": eyebrow renders full-width above the heading, content fills
 *   the column below.
 * - layout="split": the left block (eyebrow → heading → lead → children) sits
 *   top-aligned beside the `aside`, with normal paragraph spacing. Balance comes
 *   from sizing the copy and the card to comparable heights — not from vertical
 *   distribution tricks (centering floats the heading; mt-auto opens a void).
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
  const leadParas = lead == null ? [] : Array.isArray(lead) ? lead : [lead];
  const leadNode =
    leadParas.length > 0 ? (
      <div className="mt-6 max-w-[34rem] space-y-4">
        {leadParas.map((para) => (
          <p key={para.slice(0, 24)} className={leadText}>
            {para}
          </p>
        ))}
      </div>
    ) : null;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx(
        "scroll-mt-6 border-t border-[color:var(--color-border-subtle)] px-6 py-16 sm:px-12 sm:py-24",
        className,
      )}
    >
      {layout === "split" ? (
        <div className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-start lg:gap-16">
          <div className="flex min-w-0 flex-col">
            <Eyebrow label={index} tone="accent" />
            <h2 id={headingId} className={cx("mt-8", headingClass)}>
              {heading}
            </h2>
            {leadNode}
            {children ? <div className="mt-4 max-w-[34rem]">{children}</div> : null}
          </div>
          <div className="min-w-0">{aside}</div>
        </div>
      ) : (
        <>
          <Eyebrow label={index} tone="accent" />
          <h2 id={headingId} className={cx("mt-8", headingClass)}>
            {heading}
          </h2>
          {leadNode}
          <div className="mt-10 sm:mt-12">{children}</div>
        </>
      )}
    </section>
  );
}
