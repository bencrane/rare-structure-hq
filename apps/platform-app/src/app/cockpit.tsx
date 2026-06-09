/**
 * Cockpit composites — the page-scaffold + content building blocks the
 * authenticated `/app/*` surfaces compose. Routes describe content; these frame
 * it. Spacing is the rhythm contract (docs/cockpit-layout-standard.md §3.1)
 * baked in — none of these expose a raw spacing prop, so a route can't
 * hand-code a gutter or an off-scale gap. Type goes through `Text`.
 *
 * Lives under `src/app/` (not `src/routes/`) so it may own geometry; the route
 * files that compose it stay geometry-free and pass `no-route-geometry`.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, Page, type PageVariantProp, Stack, Text, cx } from "@rare-structure-hq/ui";

// ── Tile — the recurring bordered square (brand mark, avatar, empty-state icon).
export function Tile({
  tone = "default",
  size = "8",
  children,
}: {
  tone?: "default" | "accent";
  size?: "8" | "10";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center border",
        size === "8" ? "size-8" : "size-10",
        tone === "accent"
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)]",
      )}
    >
      {children}
    </div>
  );
}

// ── CockpitPage — page scaffold: gutter + centered width + title header. The
//    only owner of the page gutter (step 6→10) and the section rhythm (step 8).
export function CockpitPage({
  title,
  description,
  actions,
  width = "default",
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  width?: PageVariantProp;
  children: ReactNode;
}) {
  return (
    <div className="px-6 pt-10 pb-28 md:px-10">
      <Page variant={width} py="0">
        <Stack gap="8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Stack gap="2">
              <Text as="h1" size="display-md" face="display" color="strong">
                {title}
              </Text>
              {description ? (
                <Text size="body-sm" color="muted" className="max-w-2xl">
                  {description}
                </Text>
              ) : null}
            </Stack>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
          {children}
        </Stack>
      </Page>
    </div>
  );
}

// ── Section — a labelled content block. Section gap (step 8) between sections
//    is owned by CockpitPage's Stack; this owns the label↔body beat (step 3).
export function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <Stack as="section" gap="3">
      {label ? (
        <Text as="h2" size="mono-xs" mono color="subtle">
          {label}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}

// ── Panel — the surface block. Sharp by house style (Card owns the one rounded
//    outer edge). `padded` ⇒ card padding (step 5).
export function Panel({
  tone = "default",
  padded = true,
  className,
  children,
}: {
  tone?: "default" | "raised";
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card variant={tone} className={cx(padded && "p-5", className)}>
      {children}
    </Card>
  );
}

// ── StatCard — metric tile. Label↔value beat is step 4.
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Panel>
      <Stack gap="4">
        <div className="flex items-center justify-between">
          <Text size="mono-xs" mono color="muted">
            {label}
          </Text>
          <Icon className="size-4 text-[color:var(--color-text-subtle)]" />
        </div>
        <div className="flex items-baseline gap-2">
          <Text size="display-sm" face="display" color="strong" className="tabular-nums">
            {value}
          </Text>
          {hint ? (
            <Text size="mono-xs" mono color="subtle">
              {hint}
            </Text>
          ) : null}
        </div>
      </Stack>
    </Panel>
  );
}

// ── DataRow — label-left / value-right row with a divider. Unifies the former
//    Account.Row and Proposal.TermRow patterns.
export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border-subtle)] py-3 last:border-0">
      <Text size="mono-xs" mono color="subtle">
        {label}
      </Text>
      <Text size="body-sm" color="default" className="truncate">
        {value}
      </Text>
    </div>
  );
}

// ── EmptyState — centered placeholder for an empty surface.
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Stack gap="3" align="center" px="6" py="16" unsafe_className="text-center">
      <Tile size="10">
        <Icon className="size-5 text-[color:var(--color-text-subtle)]" />
      </Tile>
      <Text size="body-sm" color="default">
        {title}
      </Text>
      <Text size="body-xs" color="muted" className="max-w-sm">
        {description}
      </Text>
    </Stack>
  );
}
