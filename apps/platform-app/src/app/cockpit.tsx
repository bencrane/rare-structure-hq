/**
 * Cockpit primitives — page frame + content building blocks shared by the
 * authenticated `/app/*` surfaces.
 *
 * Lives under `src/app/` (not `src/routes/`) on purpose: it owns geometry
 * (`mx-auto`, `max-w-*`, route padding) so the route files that compose it stay
 * geometry-free and pass `no-route-geometry`. Routes describe content; this
 * frames it.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, Text, cx } from "@rare-structure-hq/ui";

const PAGE_W = {
  narrow: "max-w-[48rem]",
  default: "max-w-[72rem]",
  wide: "max-w-[84rem]",
} as const;

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
  width?: keyof typeof PAGE_W;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-10 md:px-10">
      <div className={cx("mx-auto w-full", PAGE_W[width])}>
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Text as="h1" size="display-md" color="strong">
              {title}
            </Text>
            {description ? (
              <Text size="body-sm" color="muted" className="max-w-2xl">
                {description}
              </Text>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

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
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <Text size="mono-xs" mono color="muted">
          {label}
        </Text>
        <Icon className="size-4 text-[color:var(--color-text-subtle)]" />
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <Text size="display-sm" color="strong" className="tabular-nums">
          {value}
        </Text>
        {hint ? (
          <Text size="mono-xs" mono color="subtle">
            {hint}
          </Text>
        ) : null}
      </div>
    </Card>
  );
}

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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)]">
        <Icon className="size-5 text-[color:var(--color-text-subtle)]" />
      </div>
      <Text size="body-sm" color="default">
        {title}
      </Text>
      <Text size="body-xs" color="muted" className="max-w-sm">
        {description}
      </Text>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text as="h2" size="mono-xs" mono color="subtle" className="mb-3">
      {children}
    </Text>
  );
}
