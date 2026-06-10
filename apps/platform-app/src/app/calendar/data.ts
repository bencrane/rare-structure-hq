/**
 * Calendar prop — the deterministic schedule behind the operator's "let me check
 * my calendar" close. This is NOT a live calendar feed: it is a seeded,
 * always-packed week generator whose only job is to give a decision deadline a
 * visible, lived-in reason ("I've got allocations around your area Tuesday — I
 * can hold it until Monday").
 *
 * Invariants that keep the illusion intact:
 *   - Every week, at any offset, renders a full, irregular, back-to-back
 *     schedule. Flipping forward/back never reveals an empty week.
 *   - The schedule is a pure function of the week's Sunday, so a given week
 *     looks identical on every visit (no reshuffle between renders).
 *   - Swapping `weekEvents` for a DB/API read later is a one-import change —
 *     nothing downstream knows the data is seeded.
 *
 * Lives under `src/app/` (not `src/routes/`) so it may own geometry constants.
 */

export type EventCategory = "allocation" | "prospect" | "partner" | "internal" | "personal";

export interface CalEvent {
  id: string;
  /** 0=Sun … 6=Sat, within the rendered week. */
  day: number;
  /** Minutes from local midnight. */
  start: number;
  /** Minutes from local midnight. */
  end: number;
  /** Named-mode label — what the operator sees. */
  title: string;
  category: EventCategory;
  capability?: string;
  geo?: string;
  allDay?: boolean;
}

export interface PositionedEvent extends CalEvent {
  lane: number;
  lanes: number;
}

// ── Grid geometry — single source; the grid composite imports these. ──
export const START_HOUR = 7;
export const END_HOUR = 20;
export const HOUR_PX = 52;
export const DAY_START_MIN = START_HOUR * 60;
export const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

// ── Curated pools — heavy-civil / industrial / environmental origination. ──
const COMPANIES = [
  "Sterling Civil Group",
  "Granite Ridge Contractors",
  "Permian Basin Earthworks",
  "Gulf Coast Remediation",
  "Cascade Environmental",
  "Lone Star Aggregate",
  "Tidewater Marine Construction",
  "Cardinal Infrastructure",
  "Blackland Excavation",
  "Sentinel Industrial Services",
  "Ironwood Demolition",
  "Redhawk Site Works",
  "Meridian Heavy Civil",
  "Cypress Environmental",
  "Vanguard Earthmoving",
  "Bedrock Foundations",
] as const;

const PARTNERS = [
  "Apex Equipment Finance",
  "Summit Equipment Rental",
  "Meridian Surety",
  "Keystone Environmental Counsel",
  "Atlas Crane & Rigging",
  "Provident Capital",
  "Frontier Hazmat",
  "Pinnacle Bonding",
  "Greenfield Remediation",
  "Hallmark Fleet Leasing",
] as const;

const CAPS = [
  "Earthwork",
  "Hazmat Remediation",
  "Equipment Finance",
  "Equipment Rental",
  "Surety & Bonding",
  "Environmental Counsel",
  "Site Remediation",
  "Demolition",
  "Aggregate Supply",
  "Crane & Rigging",
  "Fleet Leasing",
] as const;

const GEOS = [
  "TX-Gulf",
  "Permian",
  "Mid-Atlantic",
  "SoCal",
  "Gulf Coast",
  "Appalachia",
  "Front Range",
  "Great Lakes",
  "Pacific NW",
  "Tidewater",
  "Four Corners",
  "Piedmont",
] as const;

const CATALYSTS = [
  "USACE award",
  "EPA consent decree",
  "DOT-IDIQ",
  "NAVFAC task order",
  "Superfund RA",
  "FEMA debris",
  "state SRF award",
  "BIL corridor award",
] as const;

const INTERNAL = [
  "Origination standup",
  "Signal review",
  "Pipeline triage",
  "Detection QA",
  "Allocation desk",
  "Routing review",
  "Partner ops sync",
] as const;

const PERSONAL = ["Lunch", "Hold", "Block", "Travel buffer", "Focus block", "Personal"] as const;

// ── Per-category color treatment (left bar + soft fill + meta text). ──
export interface CategoryStyle {
  bar: string;
  bg: string;
  meta: string;
}

export const CATEGORY_STYLE: Record<EventCategory, CategoryStyle> = {
  allocation: {
    bar: "var(--color-text-accent)",
    bg: "var(--color-accent-soft)",
    meta: "var(--color-text-accent)",
  },
  prospect: {
    bar: "var(--color-state-success)",
    bg: "var(--color-state-successSoft)",
    meta: "var(--color-state-success)",
  },
  partner: {
    bar: "var(--color-state-info)",
    bg: "rgba(96, 165, 250, 0.12)",
    meta: "var(--color-state-info)",
  },
  internal: {
    bar: "var(--color-border-strong)",
    bg: "var(--color-surface-raised)",
    meta: "var(--color-text-subtle)",
  },
  personal: {
    bar: "var(--color-state-warn)",
    bg: "var(--color-state-warnSoft)",
    meta: "var(--color-state-warn)",
  },
};

// ── Deterministic PRNG (mulberry32) so a week is stable across renders. ──
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// prospect / allocation / partner weighted heavier than internal.
const CATEGORY_BAG: EventCategory[] = [
  "prospect",
  "prospect",
  "prospect",
  "allocation",
  "allocation",
  "allocation",
  "partner",
  "partner",
  "internal",
  "internal",
];

const DURATIONS = [30, 30, 45, 60, 60, 60, 90];
const GAPS = [0, 0, 0, 0, 15, 30];

function makeEvent(
  rng: () => number,
  day: number,
  start: number,
  end: number,
  mkId: () => string,
): CalEvent {
  const category = pick(rng, CATEGORY_BAG);
  const co = pick(rng, COMPANIES);
  const capability = pick(rng, CAPS);
  const geo = pick(rng, GEOS);

  switch (category) {
    case "prospect":
      return {
        id: mkId(),
        day,
        start,
        end,
        category,
        capability,
        geo,
        title: pick(rng, [
          `Intro · ${co}`,
          `${co} — ${pick(rng, CATALYSTS)}`,
          `Discovery · ${co}`,
          co,
        ]),
      };
    case "allocation":
      return {
        id: mkId(),
        day,
        start,
        end,
        category,
        capability,
        geo,
        title: pick(rng, [
          `${capability} allocation — ${co}`,
          `Allocation · ${capability}`,
          `${co} — ${capability} hold`,
        ]),
      };
    case "partner":
      return {
        id: mkId(),
        day,
        start,
        end,
        category,
        capability,
        title: pick(rng, [
          `Partner desk — ${pick(rng, PARTNERS)}`,
          `${capability} desk sync`,
          `Routing · ${pick(rng, PARTNERS)}`,
        ]),
      };
    default:
      return { id: mkId(), day, start, end, category: "internal", title: pick(rng, INTERNAL) };
  }
}

/**
 * A full, deterministic week of events keyed by the week's Sunday. Weekdays are
 * packed 7:30a–~6p with back-to-backs, a lunch, and ~50% chance of a
 * double-booking; weekends are sparse; ~half the weeks carry an all-day banner.
 */
export function weekEvents(weekStart: Date): CalEvent[] {
  const seed = Math.floor(weekStart.getTime() / 86_400_000);
  const rng = mulberry32(seed);
  const events: CalEvent[] = [];
  let n = 0;
  const mkId = () => `${seed}-${n++}`;

  // 0–1 all-day banner on a weekday.
  if (rng() < 0.55) {
    const day = 1 + Math.floor(rng() * 5);
    const geo = pick(rng, GEOS);
    const capability = pick(rng, CAPS);
    events.push({
      id: mkId(),
      day,
      start: 0,
      end: 0,
      allDay: true,
      category: "allocation",
      capability,
      geo,
      title: pick(rng, [
        `Site visit — ${pick(rng, COMPANIES)} (${geo})`,
        `${geo} allocation review`,
        `Partner offsite — ${pick(rng, PARTNERS)}`,
      ]),
    });
  }

  for (let day = 0; day < 7; day++) {
    const weekday = day >= 1 && day <= 5;
    if (!weekday) {
      // Weekends read as real: mostly empty, occasionally one personal block.
      if (rng() < 0.4) {
        const start = pick(rng, [540, 600, 870]);
        const dur = pick(rng, [60, 90, 120]);
        events.push({
          id: mkId(),
          day,
          start,
          end: start + dur,
          category: "personal",
          title: pick(rng, PERSONAL),
        });
      }
      continue;
    }

    let cursor = pick(rng, [450, 480, 510]); // 7:30 / 8:00 / 8:30
    const dayEnd = pick(rng, [1050, 1080, 1110]); // 17:30 / 18:00 / 18:30
    let lunched = false;
    while (cursor < dayEnd) {
      if (!lunched && cursor >= 690 && cursor <= 780) {
        const dur = pick(rng, [30, 45]);
        events.push({
          id: mkId(),
          day,
          start: cursor,
          end: cursor + dur,
          category: "personal",
          title: "Lunch",
        });
        cursor += dur;
        lunched = true;
        continue;
      }
      const dur = pick(rng, DURATIONS);
      const end = Math.min(cursor + dur, dayEnd);
      events.push(makeEvent(rng, day, cursor, end, mkId));
      cursor = end + pick(rng, GAPS);
    }

    // ~50% of weekdays carry a double-booking — real operators are over-committed.
    if (rng() < 0.5) {
      const base = events.find((e) => e.day === day && !e.allDay && e.end - e.start >= 60);
      if (base) {
        events.push({
          id: mkId(),
          day,
          start: base.start + 15,
          end: base.start + 45,
          category: "internal",
          title: pick(rng, INTERNAL),
        });
      }
    }
  }

  return events;
}

/**
 * Lane assignment for overlapping events within one day. Events are grouped into
 * clusters of transitive overlap; within a cluster each event takes the first
 * free lane, and all share the cluster's lane count so widths divide evenly.
 */
export function positionDay(dayEvents: CalEvent[]): PositionedEvent[] {
  const timed = dayEvents
    .filter((e) => !e.allDay)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: PositionedEvent[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneEnds: number[] = [];
    const assigned: Array<{ ev: CalEvent; lane: number }> = [];
    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ev.end);
      } else {
        laneEnds[lane] = ev.end;
      }
      assigned.push({ ev, lane });
    }
    const lanes = laneEnds.length;
    for (const { ev, lane } of assigned) out.push({ ...ev, lane, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of timed) {
    if (cluster.length && ev.start >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end);
  }
  if (cluster.length) flush();
  return out;
}

/**
 * The screen-share-safe relabeling. Named mode shows the real subject; anonymized
 * mode collapses every block to its allocation TYPE + capability/geo — which is
 * exactly the exclusivity signal ("routing within this capability in this geo")
 * without exposing a single client name.
 */
export function eventLabel(ev: CalEvent, anonymized: boolean): { title: string; meta?: string } {
  if (!anonymized) {
    const meta =
      ev.capability && ev.geo ? `${ev.capability} · ${ev.geo}` : (ev.capability ?? ev.geo);
    return { title: ev.title, meta };
  }
  switch (ev.category) {
    case "allocation":
      return { title: "Allocation hold", meta: codeMeta(ev) };
    case "prospect":
      return { title: "Introduction", meta: codeMeta(ev) };
    case "partner":
      return { title: "Partner desk", meta: ev.capability };
    case "internal":
      return { title: "Internal" };
    default:
      return { title: "Private" };
  }
}

function codeMeta(ev: CalEvent): string | undefined {
  if (ev.capability && ev.geo) return `${ev.capability} / ${ev.geo}`;
  return ev.capability ?? ev.geo;
}

// ── Date + time helpers (pure). ──
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sM = weekStart.getMonth();
  const eM = end.getMonth();
  const sY = weekStart.getFullYear();
  const eY = end.getFullYear();
  if (sY !== eY) {
    return `${MONTHS[sM].slice(0, 3)} ${weekStart.getDate()}, ${sY} – ${MONTHS[eM].slice(0, 3)} ${end.getDate()}, ${eY}`;
  }
  if (sM !== eM) {
    return `${MONTHS[sM].slice(0, 3)} ${weekStart.getDate()} – ${MONTHS[eM].slice(0, 3)} ${end.getDate()}, ${sY}`;
  }
  return `${MONTHS[sM]} ${weekStart.getDate()} – ${end.getDate()}, ${sY}`;
}

function ampm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const mer = h < 12 ? "a" : "p";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${mer}` : `${hh}${mer}`;
}

export function formatRange(start: number, end: number): string {
  return `${ampm(start)}–${ampm(end)}`;
}

export function hourLabel(h: number): string {
  const mer = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${mer}`;
}

export function gmtLabel(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(offMin) / 60);
  const m = Math.abs(offMin) % 60;
  return m ? `GMT${sign}${h}:${String(m).padStart(2, "0")}` : `GMT${sign}${h}`;
}
