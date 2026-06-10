/**
 * WeekGrid — the calendar surface itself. Owns all of the calendar geometry (the
 * day/time grid, absolutely-positioned event blocks, overlap lanes, the red
 * "now" line) so the route stays geometry-free. Lives under `src/app/`.
 *
 * Believability is the spec: hour gridlines, a today column with a filled date
 * chip, a live now-line, and back-to-back blocks with real overlap. The
 * anonymize flag only swaps the text — density, color, and position are
 * identical, so the board reads the same whether or not the screen is turned.
 */
import { Text } from "@rare-structure-hq/ui";

import {
  CATEGORY_STYLE,
  type CalEvent,
  DAY_START_MIN,
  END_HOUR,
  GRID_HEIGHT,
  HOUR_PX,
  START_HOUR,
  addDays,
  eventLabel,
  formatRange,
  gmtLabel,
  hourLabel,
  isSameDay,
  positionDay,
} from "./data";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const GRID_COLS = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const BORDER = "border-[color:var(--color-border-subtle)]";

interface WeekGridProps {
  weekStart: Date;
  events: CalEvent[];
  anonymized: boolean;
  now: Date;
}

export function WeekGrid({ weekStart, events, anonymized, now }: WeekGridProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const allDay = events.filter((e) => e.allDay);
  const positioned = days.map((_, i) => positionDay(events.filter((e) => e.day === i)));

  const todayIdx = days.findIndex((d) => isSameDay(d, now));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = todayIdx >= 0 && nowMin >= DAY_START_MIN && nowMin <= END_HOUR * 60;
  const nowTop = ((nowMin - DAY_START_MIN) / 60) * HOUR_PX;

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[52rem]">
        {/* Sticky header — weekday/date row + all-day band scroll-pinned together. */}
        <div
          className={`sticky top-0 z-20 border-b bg-[color:var(--color-surface-base)] ${BORDER}`}
        >
          <div className={GRID_COLS}>
            <div className="flex items-end justify-end pr-2 pb-2">
              <Text size="mono-xs" mono color="subtle">
                {gmtLabel(now)}
              </Text>
            </div>
            {days.map((d, i) => {
              const today = i === todayIdx;
              return (
                <div
                  key={d.toISOString()}
                  className={`flex flex-col items-center gap-1 border-l py-2 ${BORDER}`}
                >
                  <Text size="mono-xs" mono color={today ? "accent" : "subtle"}>
                    {DOW[i]}
                  </Text>
                  {today ? (
                    <span className="flex size-7 items-center justify-center bg-[color:var(--color-accent-primary)]">
                      <Text as="span" size="body-sm" face="display" color="onAccent">
                        {d.getDate()}
                      </Text>
                    </span>
                  ) : (
                    <Text as="span" size="body-sm" face="display" color="strong">
                      {d.getDate()}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`${GRID_COLS} border-t ${BORDER}`}>
            <div className="flex items-center justify-end py-1 pr-2">
              <Text size="mono-xs" mono color="subtle">
                ALL-DAY
              </Text>
            </div>
            {days.map((d, i) => {
              const items = allDay.filter((e) => e.day === i);
              return (
                <div key={d.toISOString()} className={`min-h-7 border-l p-1 ${BORDER}`}>
                  {items.map((ev) => {
                    const { title, meta } = eventLabel(ev, anonymized);
                    const s = CATEGORY_STYLE[ev.category];
                    return (
                      <div
                        key={ev.id}
                        className="truncate border-l-2 px-1.5 py-0.5"
                        style={{ borderColor: s.bar, background: s.bg }}
                        title={meta ? `${title} · ${meta}` : title}
                      >
                        <span className="block truncate text-body-xs font-medium text-[color:var(--color-text-strong)]">
                          {title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body — hour gutter + 7 day columns with positioned events. */}
        <div className={`relative ${GRID_COLS}`} style={{ height: GRID_HEIGHT }}>
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                {h > START_HOUR ? (
                  <Text size="mono-xs" mono color="subtle">
                    {hourLabel(h)}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>

          {days.map((d, i) => (
            <div
              key={d.toISOString()}
              className={`relative border-l ${BORDER}`}
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border-subtle) 0, var(--color-border-subtle) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
              }}
            >
              {positioned[i].map((ev) => {
                const top = ((ev.start - DAY_START_MIN) / 60) * HOUR_PX;
                const height = Math.max(((ev.end - ev.start) / 60) * HOUR_PX, 20);
                const width = 100 / ev.lanes;
                const { title, meta } = eventLabel(ev, anonymized);
                const s = CATEGORY_STYLE[ev.category];
                const range = formatRange(ev.start, ev.end);
                return (
                  <div
                    key={ev.id}
                    className="absolute p-px"
                    style={{ top, height, left: `${ev.lane * width}%`, width: `${width}%` }}
                  >
                    <div
                      className="flex h-full flex-col overflow-hidden border-l-2 px-1.5 py-0.5"
                      style={{ borderColor: s.bar, background: s.bg }}
                      title={meta ? `${title} · ${meta} · ${range}` : `${title} · ${range}`}
                    >
                      <span className="truncate text-body-xs font-medium leading-tight text-[color:var(--color-text-strong)]">
                        {title}
                      </span>
                      {height >= 42 ? (
                        <span
                          className="truncate font-mono text-mono-xs leading-tight"
                          style={{ color: s.meta }}
                        >
                          {range}
                        </span>
                      ) : null}
                      {height >= 64 && meta ? (
                        <span className="mt-auto truncate font-mono text-mono-xs uppercase text-[color:var(--color-text-subtle)]">
                          {meta}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {showNow && i === todayIdx ? (
                <div className="absolute right-0 left-0 z-10" style={{ top: nowTop }}>
                  <div className="relative h-px bg-[color:var(--color-state-error)]">
                    <span className="absolute -top-1 -left-1 size-2 rounded-full bg-[color:var(--color-state-error)]" />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
