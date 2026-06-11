import { useEffect, useRef, useState } from "react";
import { StatusDot } from "../components/StatusDot";
import { BoltIcon } from "../components/icons";
import { type FeedEvent, type Severity, feedPool, feedSeed, heroStats } from "../data/site";
import { cx } from "../lib/cx";

const TICK_MS = 5000;
// Hold the row count fixed at the seed length so the list never grows/shrinks
// (no layout shift); each tick only ages rows and swaps the top one.
const MAX_ROWS = feedSeed.length;
const FRESH_S = 45;

const railTone: Record<Severity, string> = {
  critical: "bg-[color:var(--color-state-error)]",
  elevated: "bg-[color:var(--color-state-warn)]",
  standard: "bg-[color:var(--color-border-strong)]",
};

function formatAge(seconds: number): string {
  if (seconds < FRESH_S) return "Just Now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}M Ago`;
  return `${Math.round(minutes / 60)}H Ago`;
}

/**
 * Live Enforcement Intercept panel. Seeds with `feedSeed`, then on each tick
 * ages every row and (most ticks) prepends a fresh intercept drawn from
 * `feedPool`, trimming back to MAX_ROWS. Only the new top row animates in (CSS).
 * Each row carries a severity status rail; fresh rows read brighter than aged
 * ones. Pauses work while the tab is hidden. The churning list is decorative
 * (aria-hidden); the panel heading and stat summary stay accessible.
 */
export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(feedSeed);
  const nextId = useRef(feedSeed.length);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      setEvents((prev) => {
        const aged = prev.map((e) => ({ ...e, ageSeconds: e.ageSeconds + TICK_MS / 1000 }));
        if (feedPool.length > 0 && Math.random() < 0.6) {
          const template = feedPool[Math.floor(Math.random() * feedPool.length)];
          nextId.current += 1;
          const fresh: FeedEvent = { id: `evt-${nextId.current}`, ageSeconds: 0, ...template };
          return [fresh, ...aged].slice(0, MAX_ROWS);
        }
        return aged.slice(0, MAX_ROWS);
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      aria-label="Live enforcement intercept"
      className="flex flex-col border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)]"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[color:var(--color-text-default)]">
          <BoltIcon className="text-[color:var(--color-text-accent)]" />
          Live Enforcement Intercept
        </span>
        <span className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
          <StatusDot tone="success" />
          Live
        </span>
      </div>

      <ul aria-hidden="true">
        {events.map((event, i) => {
          const fresh = event.ageSeconds < FRESH_S;
          return (
            <li
              key={event.id}
              className={cx(
                "border-b border-[color:var(--color-border-subtle)] transition-colors hover:bg-[color:var(--color-surface-raised)]",
                i === 0 && "ao-feed-enter",
              )}
            >
              <div className="flex items-stretch gap-3.5 px-5 py-3.5">
                <span
                  className={cx("w-[2px] shrink-0 self-stretch", railTone[event.severity])}
                  aria-hidden="true"
                />
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div>
                    <p
                      className={cx(
                        "text-[0.9375rem] font-semibold leading-tight",
                        fresh
                          ? "text-[color:var(--color-text-primary)]"
                          : "text-[color:var(--color-text-strong)]",
                      )}
                    >
                      {event.title}
                    </p>
                    <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.1em]">
                      <span className="text-[color:var(--color-text-muted)]">{event.agency}</span>
                      <span className="text-[color:var(--color-text-subtle)]">
                        {" · "}
                        {event.location}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 whitespace-nowrap font-mono text-[0.5625rem] uppercase tracking-[0.1em]",
                      fresh
                        ? "text-[color:var(--color-text-muted)]"
                        : "text-[color:var(--color-text-subtle)]",
                    )}
                  >
                    {formatAge(event.ageSeconds)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-1 items-center justify-center px-5 py-6">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Monitoring 8 Districts · 5 Agencies
        </span>
      </div>

      <div className="grid grid-cols-3 border-t border-[color:var(--color-border-default)]">
        {heroStats.map((stat, i) => (
          <div
            key={stat.label}
            className={cx(
              "px-3 py-5 sm:px-4",
              i > 0 && "border-l border-[color:var(--color-border-subtle)]",
            )}
          >
            <p className="text-[1.25rem] font-semibold leading-none tabular-nums text-[color:var(--color-text-primary)] sm:text-[1.375rem]">
              {stat.value}
            </p>
            <p className="mt-2 font-mono text-[0.5625rem] uppercase leading-[1.4] tracking-[0.1em] text-[color:var(--color-text-subtle)]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
