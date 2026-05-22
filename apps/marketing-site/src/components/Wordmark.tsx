/**
 * Wordmark — the refined rectangle container holding the "RARE STRUCTURE"
 * wordmark. The whole homepage, visually.
 *
 * The elevation over the old site's thin rectangle is here: a double-rule
 * frame (a hairline outer keyline + an inset bordered panel), corner ticks
 * that register the container as a deliberate instrument rather than a plain
 * box, a faint translucent surface wash so the wordmark sits *on* something
 * against the starfield, and generous internal spacing. The wordmark itself
 * is letter-spaced mono caps split into two weights — RARE in the bright
 * primary text role, STRUCTURE in the muted role — with a mono eyebrow and
 * footer that frame it as an institutional origination firm.
 *
 * Every colour and spacing value is a `@rare-structure-hq/tokens` token
 * (consumed as CSS custom properties / the `Text` primitive). No raw hex,
 * no raw px.
 */

import { Text } from "@rare-structure-hq/ui";

export function Wordmark() {
  return (
    <div className="relative">
      {/* Outer keyline — a hairline frame offset from the panel. */}
      <div
        aria-hidden="true"
        className="-inset-3 sm:-inset-4 absolute border border-[color:var(--color-border-subtle)]"
      />

      {/* The panel — inset bordered surface with a translucent wash. */}
      <div className="relative border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] px-10 py-12 backdrop-blur-[2px] sm:px-20 sm:py-16">
        {/* Corner ticks — register the frame as a deliberate instrument. */}
        <CornerTicks />

        <div className="flex flex-col items-center gap-6 sm:gap-8">
          {/* Eyebrow */}
          <Text as="span" size="mono-xs" color="subtle" className="font-mono tracking-[0.34em]">
            Origination
          </Text>

          {/* The wordmark — letter-spaced mono caps, two weights. */}
          <h1 className="text-center font-display font-semibold uppercase leading-[0.95]">
            <span className="block text-[2.5rem] tracking-[0.36em] text-[color:var(--color-text-primary)] sm:text-[4.25rem]">
              Rare
            </span>
            <span className="mt-2 block text-[2.5rem] tracking-[0.3em] text-[color:var(--color-text-muted)] sm:mt-3 sm:text-[4.25rem]">
              Structure
            </span>
          </h1>

          {/* Hairline rule */}
          <div aria-hidden="true" className="h-px w-16 bg-[color:var(--color-border-strong)]" />

          {/* Footer line */}
          <Text
            as="span"
            size="mono-xs"
            color="subtle"
            className="text-center font-mono tracking-[0.26em]"
          >
            Catalyst-driven capital formation
          </Text>
        </div>
      </div>
    </div>
  );
}

/**
 * CornerTicks — four short L-brackets at the panel corners. Pure decoration;
 * carries the "instrument, not a box" read. Token border colour.
 */
function CornerTicks() {
  const arm = "absolute h-3 w-3 border-[color:var(--color-border-strong)]";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className={`${arm} top-0 left-0 border-t border-l`} />
      <span className={`${arm} top-0 right-0 border-t border-r`} />
      <span className={`${arm} bottom-0 left-0 border-b border-l`} />
      <span className={`${arm} right-0 bottom-0 border-r border-b`} />
    </div>
  );
}
