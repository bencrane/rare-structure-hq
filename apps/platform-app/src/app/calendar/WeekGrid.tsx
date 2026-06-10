/**
 * WeekGrid — the interactive calendar surface. Owns all grid geometry AND the
 * direct-manipulation layer that makes it feel like a real calendar:
 *
 *   - drag an event body  → reschedule (vertical = time, horizontal = day)
 *   - drag the bottom edge → change duration
 *   - drag empty space     → create a meeting over that range
 *   - click an event       → open it; click empty → new meeting at that slot
 *
 * Everything snaps to 15 minutes. Seeded backdrop and operator-created events are
 * the same shape (source-tagged); booked meetings carry a check. The route stays
 * geometry-free; this composite lives under `src/app/`.
 */
import { Check } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Text } from "@rare-structure-hq/ui";

import {
  CATEGORY_STYLE,
  type CalEvent,
  DAY_START_MIN,
  END_HOUR,
  GRID_HEIGHT,
  HOUR_PX,
  SNAP_MIN,
  START_HOUR,
  clampMinutes,
  eventLabel,
  formatRange,
  gmtLabel,
  hourLabel,
  isSameDay,
  positionDay,
  snapMinutes,
} from "./data";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const GRID_COLS = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";
const GUTTER_PX = 56; // 3.5rem
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const BORDER = "border-[color:var(--color-border-subtle)]";
const END_MIN = END_HOUR * 60;

type Drag =
  | {
      kind: "move";
      ev: CalEvent;
      grab: number;
      day: number;
      start: number;
      end: number;
      moved: boolean;
    }
  | { kind: "resize"; ev: CalEvent; day: number; start: number; end: number; moved: boolean }
  | { kind: "create"; day: number; anchor: number; start: number; end: number };

interface WeekGridProps {
  weekStart: Date;
  events: CalEvent[];
  anonymized: boolean;
  now: Date;
  onCreate: (day: number, start: number, end: number) => void;
  onOpen: (ev: CalEvent) => void;
  onMove: (ev: CalEvent, day: number, start: number, end: number) => void;
}

export function WeekGrid({
  weekStart,
  events,
  anonymized,
  now,
  onCreate,
  onOpen,
  onMove,
}: WeekGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const allDay = events.filter((e) => e.allDay);

  const todayIdx = days.findIndex((d) => isSameDay(d, now));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = todayIdx >= 0 && nowMin >= DAY_START_MIN && nowMin <= END_MIN;
  const nowTop = ((nowMin - DAY_START_MIN) / 60) * HOUR_PX;

  // ── pointer → grid coordinates ──
  const yToMin = useCallback((clientY: number) => {
    const r = bodyRef.current?.getBoundingClientRect();
    if (!r) return DAY_START_MIN;
    return DAY_START_MIN + ((clientY - r.top) / HOUR_PX) * 60;
  }, []);
  const xToDay = useCallback((clientX: number) => {
    const r = bodyRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const dayW = (r.width - GUTTER_PX) / 7;
    return Math.max(0, Math.min(6, Math.floor((clientX - r.left - GUTTER_PX) / dayW)));
  }, []);

  const startMove = (e: ReactPointerEvent, ev: CalEvent) => {
    e.stopPropagation();
    dragRef.current = {
      kind: "move",
      ev,
      grab: yToMin(e.clientY) - ev.start,
      day: ev.day,
      start: ev.start,
      end: ev.end,
      moved: false,
    };
    setDragging(true);
  };

  const startResize = (e: ReactPointerEvent, ev: CalEvent) => {
    e.stopPropagation();
    dragRef.current = {
      kind: "resize",
      ev,
      day: ev.day,
      start: ev.start,
      end: ev.end,
      moved: false,
    };
    setDragging(true);
  };

  const startCreate = (e: ReactPointerEvent, day: number) => {
    if (e.target !== e.currentTarget) return; // only on the column background
    const anchor = clampMinutes(snapMinutes(yToMin(e.clientY)));
    dragRef.current = { kind: "create", day, anchor, start: anchor, end: anchor + SNAP_MIN };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "move") {
        const dur = d.ev.end - d.ev.start;
        let start = clampMinutes(snapMinutes(yToMin(e.clientY) - d.grab));
        let end = start + dur;
        if (end > END_MIN) {
          end = END_MIN;
          start = end - dur;
        }
        const day = xToDay(e.clientX);
        dragRef.current = {
          ...d,
          day,
          start,
          end,
          moved: d.moved || start !== d.ev.start || day !== d.ev.day,
        };
      } else if (d.kind === "resize") {
        const end = clampMinutes(snapMinutes(yToMin(e.clientY)));
        dragRef.current = { ...d, end: Math.max(end, d.start + SNAP_MIN), moved: true };
      } else {
        const cur = clampMinutes(snapMinutes(yToMin(e.clientY)));
        dragRef.current = {
          ...d,
          start: Math.min(d.anchor, cur),
          end: Math.max(d.anchor + SNAP_MIN, cur),
        };
      }
      rerender();
    };
    const onPointerUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (!d) return;
      if (d.kind === "move") {
        if (d.moved) onMove(d.ev, d.day, d.start, d.end);
        else onOpen(d.ev);
      } else if (d.kind === "resize") {
        if (d.moved) onMove(d.ev, d.day, d.start, d.end);
        else onOpen(d.ev);
      } else {
        let { start, end } = d;
        if (end - start <= SNAP_MIN) end = Math.min(start + 45, END_MIN);
        onCreate(d.day, start, end);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, onCreate, onMove, onOpen, yToMin, xToDay, rerender]);

  // Apply the live drag position to the dragged event so it follows the pointer.
  const drag = dragRef.current;
  const effective = events.map((e) =>
    drag && (drag.kind === "move" || drag.kind === "resize") && drag.ev.id === e.id
      ? { ...e, day: drag.day, start: drag.start, end: drag.end }
      : e,
  );
  const positioned = days.map((_, i) =>
    positionDay(effective.filter((e) => !e.allDay && e.day === i)),
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[52rem]">
        {/* Sticky header — weekday/date row + all-day band. */}
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
            {days.map((d, i) => (
              <div key={d.toISOString()} className={`min-h-7 border-l p-1 ${BORDER}`}>
                {allDay
                  .filter((e) => e.day === i)
                  .map((ev) => {
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
            ))}
          </div>
        </div>

        {/* Body — hour gutter + 7 day columns with positioned, draggable events. */}
        <div
          ref={bodyRef}
          className={`relative ${GRID_COLS} ${dragging ? "cursor-grabbing select-none" : ""}`}
          style={{ height: GRID_HEIGHT }}
        >
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
              onPointerDown={(e) => startCreate(e, i)}
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
                const isDragged = drag && "ev" in drag && drag.ev.id === ev.id && drag.moved;
                return (
                  <div
                    key={ev.id}
                    className="group absolute p-px"
                    style={{
                      top,
                      height,
                      left: `${ev.lane * width}%`,
                      width: `${width}%`,
                      touchAction: "none",
                    }}
                  >
                    <div
                      onPointerDown={(e) => startMove(e, ev)}
                      className={`relative flex h-full cursor-grab flex-col overflow-hidden border-l-2 px-1.5 py-0.5 ${
                        isDragged
                          ? "opacity-90 shadow-lg ring-1 ring-[color:var(--color-text-accent)]"
                          : ""
                      } ${ev.booked ? "ring-1 ring-[color:var(--color-border-accent)]" : ""}`}
                      style={{ borderColor: s.bar, background: s.bg }}
                      title={meta ? `${title} · ${meta} · ${range}` : `${title} · ${range}`}
                    >
                      <div className="flex items-start gap-1">
                        <span className="flex-1 truncate text-body-xs font-medium leading-tight text-[color:var(--color-text-strong)]">
                          {title}
                        </span>
                        {ev.booked ? (
                          <Check className="mt-px size-3 shrink-0 text-[color:var(--color-text-accent)]" />
                        ) : null}
                      </div>
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
                      <div
                        onPointerDown={(e) => startResize(e, ev)}
                        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ touchAction: "none" }}
                      />
                    </div>
                  </div>
                );
              })}

              {drag?.kind === "create" && drag.day === i ? (
                <div
                  className="pointer-events-none absolute inset-x-px border border-[color:var(--color-text-accent)] border-dashed bg-[color:var(--color-accent-soft)] px-1.5 py-0.5"
                  style={{
                    top: ((drag.start - DAY_START_MIN) / 60) * HOUR_PX,
                    height: Math.max(((drag.end - drag.start) / 60) * HOUR_PX, 16),
                  }}
                >
                  <span className="truncate font-mono text-mono-xs text-[color:var(--color-text-accent)]">
                    {formatRange(drag.start, drag.end)}
                  </span>
                </div>
              ) : null}

              {showNow && i === todayIdx ? (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-10"
                  style={{ top: nowTop }}
                >
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
