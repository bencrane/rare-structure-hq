/**
 * CalendarInstrument — the full-bleed calendar tab: toolbar (Today · week nav ·
 * week label · anonymize toggle) over the week grid. Holds the only two pieces
 * of state — which week is shown and whether the board is anonymized — and lives
 * under `src/app/` so it may own the instrument geometry. The route is a thin
 * mount, like MapTab.
 *
 * The anonymize toggle is the screen-share switch: one tap relabels every block
 * to its allocation type + capability/geo so the operator can turn the laptop to
 * the prospect without exposing a client name.
 */
import { CalendarRange, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Inline, Text } from "@rare-structure-hq/ui";

import { WeekGrid } from "./WeekGrid";
import { addDays, startOfWeek, weekEvents, weekLabel } from "./data";

const ICON_BTN =
  "flex size-8 items-center justify-center text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]";

export function CalendarInstrument() {
  // `now` is pinned for the lifetime of the tab so the today column / now-line
  // don't jump mid-session; the week shown is `now`'s week shifted by `offset`.
  const now = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0);
  const [anonymized, setAnonymized] = useState(false);

  const weekStart = useMemo(() => addDays(startOfWeek(now), offset * 7), [now, offset]);
  const events = useMemo(() => weekEvents(weekStart), [weekStart]);

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col overflow-hidden md:h-dvh">
      <Inline
        justify="between"
        align="center"
        px="4"
        py="3"
        unsafe_className="shrink-0 border-b border-[color:var(--color-border-subtle)]"
      >
        <Inline gap="3" align="center">
          <Button size="sm" variant="secondary" onClick={() => setOffset(0)}>
            Today
          </Button>
          <Inline gap="0" align="center">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setOffset((o) => o - 1)}
              className={ICON_BTN}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setOffset((o) => o + 1)}
              className={ICON_BTN}
            >
              <ChevronRight className="size-4" />
            </button>
          </Inline>
          <Text size="display-xs" face="display" color="strong" className="whitespace-nowrap">
            {weekLabel(weekStart)}
          </Text>
        </Inline>

        <Inline gap="3" align="center">
          <Inline
            gap="2"
            align="center"
            px="3"
            py="2"
            unsafe_className="hidden border border-[color:var(--color-border-subtle)] sm:flex"
          >
            <CalendarRange className="size-4 text-[color:var(--color-text-subtle)]" />
            <Text size="mono-xs" mono color="muted">
              Week
            </Text>
          </Inline>
          <Button
            size="sm"
            variant={anonymized ? "primary" : "secondary"}
            aria-pressed={anonymized}
            onClick={() => setAnonymized((a) => !a)}
          >
            {anonymized ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {anonymized ? "Anonymized" : "Anonymize"}
          </Button>
        </Inline>
      </Inline>

      <WeekGrid weekStart={weekStart} events={events} anonymized={anonymized} now={now} />
    </div>
  );
}
