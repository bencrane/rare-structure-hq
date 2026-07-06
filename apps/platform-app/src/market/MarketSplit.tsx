/**
 * MarketSplit — the Market tab's rail + results two-column geometry.
 *
 * Lives outside `src/routes/` so the route stays geometry-free
 * (no-route-geometry); the fixed 320px rail collapses above the results on
 * narrow viewports, same responsive idiom as AppShell's sidebar grid.
 */
import type { ReactNode } from "react";

export function MarketSplit({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6">{rail}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
