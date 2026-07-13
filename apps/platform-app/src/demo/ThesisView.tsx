/**
 * ThesisView — the deck's opening claim: the OBBBA appropriation, in the
 * bill's own terms. Public-record legislative facts (enrolled H.R.1, signed
 * 2025-07-04) — the one card in the tour whose content is statute, not query.
 * Every number downstream of this card is queryable; this card is WHY the
 * queries are worth running.
 */

import { Text } from "@rare-structure-hq/ui";

export type ThesisLine = { amount: string; label: string; detail: string };

const LINES: ThesisLine[] = [
  {
    amount: "$46.5B",
    label: "Border barrier system construction",
    detail:
      "CBP appropriation — physical barrier, access roads, lighting, sensors, attendant infrastructure",
  },
  {
    amount: "$45–75B",
    label: "Detention capacity & enforcement",
    detail: "Same bill, separate lines — facilities build-out plus CBP/ICE hiring and technology",
  },
  {
    amount: "FY26–29",
    label: "Multi-year availability",
    detail:
      "Obligates on a rolling schedule until expiry — a wave, not a spike; a large balance remains unobligated",
  },
];

export function ThesisView({
  kicker = "The thesis",
  title = "One Big Beautiful Bill Act",
  subtitle = "H.R.1 · budget reconciliation · signed July 4, 2025",
  lines = LINES,
  statement = "The largest border-construction appropriation ever enacted is obligating right now, on a rolling multi-year schedule. The rest of this walkthrough is that money — traced from the statute to the contracts to the ground it moves.",
  footer = "public record · enrolled bill text · figures per enacted appropriation",
}: {
  kicker?: string;
  title?: string;
  subtitle?: string;
  lines?: ThesisLine[];
  statement?: string;
  footer?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl text-center">
        <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
          {kicker}
        </Text>
        <Text as="div" size="display-lg" color="primary" className="mt-3 font-display font-semibold">
          {title}
        </Text>
        <Text as="div" size="mono-xs" mono color="muted" className="mt-2 uppercase tracking-[0.12em]">
          {subtitle}
        </Text>

        <div className="mt-10 grid grid-cols-3 gap-4">
          {lines.map((l) => (
            <div
              key={l.label}
              className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-5 py-6 text-left"
            >
              <Text as="div" size="display-md" color="accent" className="font-display font-semibold tabular-nums">
                {l.amount}
              </Text>
              <Text as="div" size="body-sm" color="primary" className="mt-2 font-semibold">
                {l.label}
              </Text>
              <Text as="div" size="body-sm" color="muted" className="mt-1.5">
                {l.detail}
              </Text>
            </div>
          ))}
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-10 max-w-2xl">
          {statement}
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-8 uppercase tracking-[0.12em]">
          {footer}
        </Text>
      </div>
    </div>
  );
}
