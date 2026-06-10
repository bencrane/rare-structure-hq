/**
 * CalendarInstrument — the full-bleed calendar tab. Toolbar (Today · week nav ·
 * week label · New · anonymize) over an interactive week grid backed by the
 * overlay store. Holds the view state (week offset, anonymized) and the composer/
 * toast UI state; the grid owns geometry + direct manipulation, the store owns
 * data. Lives under `src/app/`; the route is a thin mount.
 *
 * "Book them on the call" = New meeting (or click a slot) → fill the attendee →
 * Save with "Send invite" → scheduleInvite() fires (stubbed) and the block lands
 * with a check. Internal blocks drag around it to free the slot.
 */
import { CalendarPlus, ChevronLeft, ChevronRight, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Inline, Text } from "@rare-structure-hq/ui";

import { type ComposerDraft, EventComposer } from "./EventComposer";
import { WeekGrid } from "./WeekGrid";
import {
  type CalEvent,
  addDays,
  clampMinutes,
  dateKey,
  diffDays,
  parseDateKey,
  startOfWeek,
  weekLabel,
} from "./data";
import { scheduleInvite } from "./invite";
import {
  createUserEvent,
  deleteSeed,
  deleteUserEvent,
  mergeWeek,
  patchSeed,
  resetOverlay,
  updateUserEvent,
  useOverlay,
} from "./store";

const ICON_BTN =
  "flex size-8 items-center justify-center text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]";

function blankDraft(date: string, start: number, end: number): ComposerDraft {
  return {
    source: "new",
    date,
    start,
    end,
    title: "",
    category: "prospect",
    attendeeName: "",
    attendeeEmail: "",
    location: "",
    notes: "",
    booked: false,
    sendInvite: false,
  };
}

function eventToDraft(ev: CalEvent, weekStart: Date): ComposerDraft {
  return {
    source: ev.source === "user" ? "user" : "seed",
    id: ev.id,
    date: dateKey(addDays(weekStart, ev.day)),
    start: ev.start,
    end: ev.end,
    title: ev.title,
    category: ev.category,
    attendeeName: ev.attendeeName ?? "",
    attendeeEmail: ev.attendeeEmail ?? "",
    location: ev.location ?? "",
    notes: ev.notes ?? "",
    booked: !!ev.booked,
    sendInvite: false,
  };
}

export function CalendarInstrument() {
  const now = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0);
  const [anonymized, setAnonymized] = useState(false);
  const [composer, setComposer] = useState<ComposerDraft | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string; tone: "success" | "warn" } | null>(
    null,
  );

  const overlay = useOverlay();
  const weekStart = useMemo(() => addDays(startOfWeek(now), offset * 7), [now, offset]);
  const events = useMemo(() => mergeWeek(weekStart, overlay), [weekStart, overlay]);

  const pushToast = useCallback((msg: string, tone: "success" | "warn" = "success") => {
    setToast({ id: Date.now(), msg, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!composer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composer]);

  const openNew = () => {
    const inWeek = diffDays(weekStart, now);
    const onToday = inWeek >= 0 && inWeek <= 6;
    const date = dateKey(onToday ? now : addDays(weekStart, 1));
    const start = onToday
      ? clampMinutes(Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 30) * 30)
      : 540;
    setComposer(blankDraft(date, start, clampMinutes(start + 45)));
  };

  const onCreate = useCallback(
    (day: number, start: number, end: number) => {
      setComposer(blankDraft(dateKey(addDays(weekStart, day)), start, end));
    },
    [weekStart],
  );

  const onOpen = useCallback(
    (ev: CalEvent) => setComposer(eventToDraft(ev, weekStart)),
    [weekStart],
  );

  const onMove = useCallback(
    (ev: CalEvent, day: number, start: number, end: number) => {
      if (ev.source === "user") {
        updateUserEvent(ev.id, { date: dateKey(addDays(weekStart, day)), start, end });
      } else {
        patchSeed(ev.id, { day, start, end });
      }
    },
    [weekStart],
  );

  const maybeInvite = (d: ComposerDraft) => {
    if (d.sendInvite && d.attendeeEmail) {
      scheduleInvite({
        id: d.id ?? "draft",
        day: 0,
        start: d.start,
        end: d.end,
        title: d.title,
        category: d.category,
        attendeeEmail: d.attendeeEmail,
        source: "user",
      }).then((r) => pushToast(r.detail, r.ok ? "success" : "warn"));
    } else {
      pushToast(d.id ? "Meeting updated" : "Meeting added");
    }
  };

  const onSave = (d: ComposerDraft) => {
    if (d.source === "seed" && d.id) {
      patchSeed(d.id, {
        day: diffDays(weekStart, parseDateKey(d.date)),
        start: d.start,
        end: d.end,
      });
    } else if (d.source === "user" && d.id) {
      updateUserEvent(d.id, {
        date: d.date,
        start: d.start,
        end: d.end,
        title: d.title,
        category: d.category,
        attendeeName: d.attendeeName || undefined,
        attendeeEmail: d.attendeeEmail || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        booked: d.booked,
      });
      maybeInvite(d);
    } else {
      createUserEvent({
        date: d.date,
        start: d.start,
        end: d.end,
        title: d.title,
        category: d.category,
        attendeeName: d.attendeeName || undefined,
        attendeeEmail: d.attendeeEmail || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        booked: d.booked,
      });
      maybeInvite(d);
    }
    setComposer(null);
  };

  const onDelete = () => {
    if (!composer?.id) return;
    if (composer.source === "seed") {
      deleteSeed(composer.id);
      pushToast("Removed from board");
    } else {
      deleteUserEvent(composer.id);
      pushToast("Meeting deleted");
    }
    setComposer(null);
  };

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

        <Inline gap="2" align="center">
          <button
            type="button"
            aria-label="Reset calendar"
            title="Clear all created meetings and moves"
            onClick={() => {
              resetOverlay();
              pushToast("Calendar reset");
            }}
            className={ICON_BTN}
          >
            <RotateCcw className="size-4" />
          </button>
          <Button
            size="sm"
            variant={anonymized ? "primary" : "secondary"}
            aria-pressed={anonymized}
            onClick={() => setAnonymized((a) => !a)}
          >
            {anonymized ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {anonymized ? "Anonymized" : "Anonymize"}
          </Button>
          <Button size="sm" variant="primary" onClick={openNew}>
            <CalendarPlus className="size-4" />
            New
          </Button>
        </Inline>
      </Inline>

      <WeekGrid
        weekStart={weekStart}
        events={events}
        anonymized={anonymized}
        now={now}
        onCreate={onCreate}
        onOpen={onOpen}
        onMove={onMove}
      />

      {composer ? (
        <EventComposer
          draft={composer}
          onSave={onSave}
          onClose={() => setComposer(null)}
          onDelete={composer.source !== "new" ? onDelete : undefined}
        />
      ) : null}

      {toast ? (
        <div className="-translate-x-1/2 fixed bottom-6 left-1/2 z-50 sm:left-auto sm:right-6 sm:translate-x-0">
          <div
            className="border-l-2 bg-[color:var(--color-surface-raised)] px-4 py-2.5 shadow-lg"
            style={{
              borderColor:
                toast.tone === "success" ? "var(--color-state-success)" : "var(--color-state-warn)",
            }}
          >
            <Text size="body-sm" color="default">
              {toast.msg}
            </Text>
          </div>
        </div>
      ) : null}
    </div>
  );
}
