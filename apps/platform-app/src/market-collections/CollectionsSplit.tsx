/**
 * CollectionsSplit — the Market tab's rail + results geometry, collections
 * edition. Wider 520px rail (the drawer form carries descriptions and grouped
 * rows); collapses above the results on narrow viewports. Local to
 * market-collections — src/market/ is archived and untouchable by ruling.
 */
import type { ReactNode } from "react";

export function CollectionsSplit({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
      <div className="xl:sticky xl:top-6">{rail}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
