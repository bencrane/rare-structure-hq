/**
 * EventComposer — the create / edit / book modal.
 *
 * Three shapes, one form:
 *   - "new"  → a fresh meeting (click an empty slot or the New button).
 *   - "user" → edit a meeting the operator created (full fields + delete).
 *   - "seed" → a backdrop block: time-only edit + "remove from board" so a slot
 *              can be freed on a call. Title/attendee are not editable (the
 *              backdrop regenerates from the seed).
 *
 * Booking the prospect = filling an attendee + leaving "Send invite" on. The
 * instrument routes that to scheduleInvite() on save.
 */
import { Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button, Text } from "@rare-structure-hq/ui";

import {
  type EventCategory,
  ampmLabel,
  clockToMinutes,
  minutesToClock,
  parseDateKey,
} from "./data";

export interface ComposerDraft {
  id?: string;
  source: "new" | "user" | "seed";
  date: string;
  start: number;
  end: number;
  title: string;
  category: EventCategory;
  attendeeName: string;
  attendeeEmail: string;
  location: string;
  notes: string;
  booked: boolean;
  sendInvite: boolean;
}

interface EventComposerProps {
  draft: ComposerDraft;
  onSave: (d: ComposerDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "allocation", label: "Allocation" },
  { value: "partner", label: "Partner" },
  { value: "internal", label: "Internal" },
  { value: "personal", label: "Personal" },
];

const labelCls = "block font-mono text-mono-xs uppercase text-[color:var(--color-text-subtle)]";
const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-3 py-2 text-body-sm text-[color:var(--color-text-default)] outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

export function EventComposer({ draft, onSave, onDelete, onClose }: EventComposerProps) {
  const [form, setForm] = useState<ComposerDraft>(draft);
  const titleRef = useRef<HTMLInputElement>(null);
  const isSeed = form.source === "seed";
  const editing = form.source !== "new";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const set = <K extends keyof ComposerDraft>(k: K, v: ComposerDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setStart = (clock: string) => {
    const start = clockToMinutes(clock);
    setForm((f) => ({ ...f, start, end: Math.max(f.end, start + 15) }));
  };
  const setEnd = (clock: string) => {
    const end = clockToMinutes(clock);
    setForm((f) => ({ ...f, end: Math.max(end, f.start + 15) }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const booked = isSeed ? form.booked : form.booked || (form.sendInvite && !!form.attendeeEmail);
    onSave({ ...form, title: form.title.trim() || "Untitled", booked });
  };

  const dateLabel = parseDateKey(form.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const summary = `${ampmLabel(form.start)}–${ampmLabel(form.end)} · ${dateLabel}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-surface-overlay)] p-4"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[26rem] rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-5 py-3">
          <Text size="mono-sm" mono color="muted">
            {isSeed ? "Backdrop block" : editing ? "Edit meeting" : "New meeting"}
          </Text>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-default)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          {isSeed ? (
            <div>
              <span className={labelCls}>Title</span>
              <Text size="body-sm" color="default" className="mt-1 truncate">
                {form.title}
              </Text>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Title</span>
              <input
                ref={titleRef}
                className={inputCls}
                value={form.title}
                placeholder="Follow-up · Acme Civil"
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <span className={labelCls}>Date</span>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                disabled={isSeed}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Start</span>
              <input
                type="time"
                step={900}
                className={inputCls}
                value={minutesToClock(form.start)}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>End</span>
              <input
                type="time"
                step={900}
                className={inputCls}
                value={minutesToClock(form.end)}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>

          {!isSeed ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Type</span>
                  <select
                    className={inputCls}
                    value={form.category}
                    onChange={(e) => set("category", e.target.value as EventCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Location</span>
                  <input
                    className={inputCls}
                    value={form.location}
                    placeholder="Google Meet"
                    onChange={(e) => set("location", e.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 border-[color:var(--color-border-subtle)] border-t pt-4">
                <Text size="mono-xs" mono color="subtle">
                  Attendee
                </Text>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    value={form.attendeeName}
                    placeholder="Name"
                    onChange={(e) => set("attendeeName", e.target.value)}
                  />
                  <input
                    type="email"
                    className={inputCls}
                    value={form.attendeeEmail}
                    placeholder="email@company.com"
                    onChange={(e) => set("attendeeEmail", e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[color:var(--color-accent-primary)]"
                    checked={form.sendInvite}
                    disabled={!form.attendeeEmail}
                    onChange={(e) => set("sendInvite", e.target.checked)}
                  />
                  <Text size="body-sm" color={form.attendeeEmail ? "default" : "subtle"}>
                    Send calendar invite to attendee
                  </Text>
                </label>
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-[color:var(--color-border-subtle)] border-t pt-4">
            <Text size="mono-xs" mono color="subtle" className="truncate">
              {summary}
            </Text>
            <div className="flex items-center gap-2">
              {editing && onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={isSeed ? "Remove from board" : "Delete"}
                  className="flex size-9 items-center justify-center border border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-state-error)] hover:text-[color:var(--color-state-error)]"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              <Button type="submit" size="sm" variant="primary">
                {!isSeed && form.sendInvite && form.attendeeEmail ? "Book & send invite" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
