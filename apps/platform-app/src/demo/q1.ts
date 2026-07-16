/**
 * Q1 canonical-query typeahead — the pure completion logic behind the ⌘K palette.
 *
 * THE TWO APPROVED SHAPES:
 *   Q1 (active): [<industry> ]companies with active {total|single} awards[ to <job>]
 *                [ in <state>][ based in <state>][ over $X][ and need <occupation>]
 *   Q2 (won):    [<industry> ]companies that have won {total|single} awards[ to <job>]
 *                [ in <state>][ based in <state>][ over $X] in the last <window>
 *                [ and need <occupation>]
 *
 * `in <state>` is place-of-performance; `based in <state>` is HQ. The grain marker
 * (`total`/`single`) is REQUIRED; every other slot is optional (the won-window is
 * required for Q2). The list defaults to Q1-only and flips to Q2 when `won` or a window
 * fragment is typed.
 * Candidates are composed CLIENT-SIDE from the canonical vocabulary — the full
 * cross-product is never pre-generated. The palette calls `q1Candidates` on every
 * keystroke and caps the list; only a completed sentence is a runnable Q1 row.
 */

import type { JtbdPhrase, Occupation } from "./federalApi";
import type { Command } from "./types";

/** Full lowercase state name → 2-letter code (50 + DC + PR). The sentence carries the
 * full name; the API gets the code. */
export const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "puerto rico": "PR",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const STATE_NAMES = Object.keys(STATE_NAME_TO_CODE);

/** Words that carry sentence scaffolding, not job-phrase meaning — dropped before the
 * substring match against the vocabulary. */
const FILLER = new Set([
  "companies",
  "with",
  "active",
  "awards",
  "award",
  "in",
  "the",
  "to",
  "that",
  "have",
  "won",
  "based",
  "need",
  "last",
  "and",
]);

/** The 30 canonical industry-vertical tokens — the optional leading `<industry> companies`
 * slot. `real estate` is the only multi-word token (longest-match first when parsing). */
export const INDUSTRIES = [
  "construction",
  "engineering",
  "environmental",
  "facilities",
  "janitorial",
  "landscaping",
  "security",
  "real estate",
  "logistics",
  "trucking",
  "aerospace",
  "shipbuilding",
  "defense",
  "manufacturing",
  "electronics",
  "machinery",
  "chemical",
  "pharmaceutical",
  "energy",
  "mining",
  "it",
  "software",
  "telecom",
  "consulting",
  "accounting",
  "legal",
  "healthcare",
  "staffing",
  "financial",
  "agriculture",
] as const;

const INDUSTRIES_BY_LEN = [...INDUSTRIES].sort((a, b) => b.length - a.length);

/** Q3 EVENT VERBS (approved 2026-07-15) — the FPDS-modification-event sentence family:
 * "[<industry> ]companies that <event verb>[ to <job>][ based in <state>][ over $X]
 *  in the last <window>[ and need <token>]". Each verb maps server-side to an
 * action_type_code set (2 are rollups). There is NO total/single grain marker, the
 * window is REQUIRED, and the `in <state>` (PoP) slot is NOT offered — the month
 * rollup has no place-of-performance columns. The verb string is sent verbatim as
 * `eventVerb`; the edge does the code mapping. `and need` / `over $X` still apply. */
export const EVENT_VERBS = [
  "picked up additional work",
  "had work added in scope",
  "received new funding",
  "got change orders",
  "had change orders priced",
  "had options exercised",
  "were terminated for default",
  "were terminated for convenience",
  "were novated",
  "picked up more work",
  "were terminated",
] as const;

/** Content tokens of the event-verb query — scaffolding words that carry no
 * discriminating signal are dropped before the AND-substring match, so a fragment
 * like `funding`, `novated`, or `change orders` surfaces the matching verb(s). */
const EVENT_VERB_FILLER = new Set(["were", "had", "got", "up", "new", "for", "in"]);

/** Match the typed verb query against the canonical event verbs (AND-substring over
 * content tokens). Returns the matching verb strings in canonical order (empty = none). */
export function matchEventVerbs(verbQuery: string): string[] {
  const toks = verbQuery
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t && !EVENT_VERB_FILLER.has(t));
  if (!toks.length) return [];
  return EVENT_VERBS.filter((v) => toks.every((t) => v.includes(t)));
}

/** The 8 approved won-window slots: day value ⊕ the tail rendered after `in the last `. */
export const WINDOWS: { days: number; render: string }[] = [
  { days: 30, render: "30 days" },
  { days: 45, render: "45 days" },
  { days: 60, render: "60 days" },
  { days: 90, render: "90 days" },
  { days: 180, render: "180 days" },
  { days: 365, render: "year" },
  { days: 730, render: "2 years" },
  { days: 1095, render: "3 years" },
];

/** Render the won-window clause: `in the last 90 days`, `in the last year`, `in the last 2 years`. */
export function renderWindow(days: number): string {
  const w = WINDOWS.find((x) => x.days === days);
  return `in the last ${w ? w.render : `${days} days`}`;
}

/** Resolve a typed window fragment to one of the 8 canonical day values (undefined = no match).
 * Accepts `90`, `90 days`, `year`, `1 year`, `2 years`, `3 years`. */
export function matchWindow(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const numM = t.match(/^(\d+)\s*(?:days?|d)?$/);
  if (numM) {
    const hit = WINDOWS.find((w) => w.days === Number(numM[1]));
    return hit?.days;
  }
  const yrM = t.match(/^(\d+)?\s*years?$/);
  if (yrM) {
    const days = (yrM[1] ? Number(yrM[1]) : 1) * 365;
    return WINDOWS.find((w) => w.days === days)?.days;
  }
  return undefined;
}

/** The job phrase as it reads in the sentence: "to: construct highways" → "to construct
 * highways" (colon dropped, "to" kept). */
export function renderJobPhrase(phrase: string): string {
  return phrase.replace(/^to:\s*/i, "to ").trim();
}

/** The phrase body used for substring matching — lowercased, without the "to:" marker. */
function phraseHaystack(phrase: string): string {
  return phrase.replace(/^to:\s*/i, "").toLowerCase();
}

/** $-shorthand for a whole-dollar amount: 15_000_000 → "$15m". Falls back to the plain
 * dollar figure when it is not a clean k/m/b multiple. */
export function formatAmount(n: number): string {
  if (n >= 1e9 && n % 1e9 === 0) return `$${n / 1e9}b`;
  if (n >= 1e6 && n % 1e6 === 0) return `$${n / 1e6}m`;
  if (n >= 1e3 && n % 1e3 === 0) return `$${n / 1e3}k`;
  return `$${n}`;
}

/** Parse a `$15m` / `500k` / `2b` shorthand (or a bare dollar figure) to a USD number. */
export function parseAmount(numStr: string, unit?: string): number {
  const base = Number.parseFloat(numStr);
  if (!Number.isFinite(base)) return 0;
  const mult = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
  return Math.round(base * mult);
}

/** Longest canonical state name the typed prefix begins, or that begins the prefix. */
function matchState(prefix: string): string | undefined {
  return STATE_NAMES.filter((n) => n.startsWith(prefix) || prefix.startsWith(n)).sort(
    (a, b) => b.length - a.length,
  )[0];
}

type Grain = "total" | "single";
type Mode = "active" | "won" | "events";

/** The resolved slots behind one candidate sentence. */
type Slots = {
  mode: Mode;
  /** Absent on event verbs — Q3 carries no total/single grain marker. */
  grain?: Grain;
  eventVerb?: string;
  industry?: string;
  jobPhrase?: string;
  stateName?: string;
  stateCode?: string;
  hqStateName?: string;
  hqStateCode?: string;
  minAmt?: number;
  windowDays?: number;
  need?: string;
};

/** Render the full Q1 (active) / Q2 (won) / Q3 (events) sentence from resolved slots. */
export function q1Sentence(slots: Slots): string {
  const {
    mode,
    grain,
    eventVerb,
    industry,
    jobPhrase,
    stateName,
    hqStateName,
    minAmt,
    windowDays,
    need,
  } = slots;
  let s = industry ? `${industry} ` : "";
  s +=
    mode === "events"
      ? `companies that ${eventVerb}`
      : mode === "won"
        ? `companies that have won ${grain} awards`
        : `companies with active ${grain} awards`;
  if (jobPhrase) s += ` ${renderJobPhrase(jobPhrase)}`;
  // `in <state>` (PoP) is not offered on event verbs — the month rollup has no PoP.
  if (stateName && mode !== "events") s += ` in ${stateName}`;
  if (hqStateName) s += ` based in ${hqStateName}`;
  if (minAmt != null) s += ` over ${formatAmount(minAmt)}`;
  if (mode === "won" || mode === "events") s += ` ${renderWindow(windowDays ?? 365)}`;
  if (need) s += ` and need ${need}`;
  return s;
}

function makeCommand(slots: Slots): Command {
  const {
    mode,
    grain,
    eventVerb,
    industry,
    jobPhrase,
    stateCode,
    hqStateCode,
    minAmt,
    windowDays,
    need,
  } = slots;
  const windowed = mode === "won" || mode === "events";
  return {
    id: `q1:${mode}:${grain ?? ""}:${eventVerb ?? ""}:${industry ?? ""}:${jobPhrase ?? ""}:${stateCode ?? ""}:${hqStateCode ?? ""}:${minAmt ?? ""}:${windowDays ?? ""}:${need ?? ""}`,
    kind: "active-awards",
    label: q1Sentence(slots),
    // No grain marker on event verbs (Q3).
    ...(mode === "events" ? {} : { grain }),
    ...(mode !== "active" ? { mode } : {}),
    ...(mode === "events" && eventVerb ? { eventVerb } : {}),
    ...(windowed && windowDays != null ? { windowDays } : {}),
    ...(jobPhrase ? { jobPhrase } : {}),
    // PoP state is never bound on event rows.
    ...(stateCode && mode !== "events" ? { stateCode } : {}),
    ...(hqStateCode ? { hqState: hqStateCode } : {}),
    ...(industry ? { industry } : {}),
    ...(need ? { need } : {}),
    ...(minAmt != null ? { minAmt } : {}),
  };
}

// The WHOLE Q1 (active) query space stays browsable: the cap only guards against pathological
// growth (2 grains x ~304 phrases ~= 610 rows — the list scrolls). Q2 (won) fans across up to
// 8 window variants per row, so the cap does real work there.
const CANDIDATE_CAP = 1000;

/**
 * Compose the Q1/Q2 candidate rows for the current palette input.
 *
 * Empty input → the full Q1 (active) space: the all-work sentences, then the ENTIRE phrase
 * space × both grains. The list defaults to Q1-ONLY; it flips to Q2 (won) only when the input
 * carries `won` or a window fragment — this keeps the browse list ~610, not ~5000.
 *
 * Slots are extracted from the trailing end inward (each removed before the next is parsed):
 *   `and need <occupation prefix>` → labor need (from the occupation vocab),
 *   `[in the ]last <window>`       → won-window (flips the sentence to Q2),
 *   `over $<amt>` / `> ` / `>= `   → obligation floor (`>`/`>=` are navigation synonyms),
 *   `based in <state>`             → HQ state (parsed BEFORE `in <state>` — longest match),
 *   `in <state>`                   → place-of-performance state,
 *   `won`/`active` + `total`/`single` → mode + grain,
 *   a leading industry token       → the industry vertical,
 *   the remaining non-filler words → an AND-substring filter over the phrase vocab.
 *
 * The result is capped at `CANDIDATE_CAP`.
 */
export function q1Candidates(
  raw: string,
  vocab: JtbdPhrase[],
  occupations: Occupation[] = [],
): Command[] {
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim();

  let rest = text;

  // ── labor need: trailing `[and ]need <occupation prefix>` (distinctive keyword) ──
  let needPrefix: string | undefined;
  const needM = rest.match(/\b(?:and\s+)?need\b\s*(.*)$/);
  if (needM) {
    needPrefix = needM[1].trim();
    rest = rest.slice(0, needM.index).trim();
  }

  // ── window: trailing `[in the ]last <window>` — its presence flips the sentence to Q2 ──
  let windowDays: number | undefined;
  let windowTyped = false;
  const winM = rest.match(/\b(?:in\s+the\s+|in\s+|the\s+)?last\b\s*(.*)$/);
  if (winM) {
    windowTyped = true;
    windowDays = matchWindow(winM[1]);
    rest = rest.slice(0, winM.index).trim();
  }

  // ── amount: `over $<amt>` (or `>` / `>=` navigation synonyms) ──
  let minAmt: number | undefined;
  const amtM = rest.match(/(?:\bover\b|>=|>)\s*\$?\s*(\d+(?:\.\d+)?)\s*([kmb])?\b/);
  if (amtM) {
    minAmt = parseAmount(amtM[1], amtM[2]);
    rest = `${rest.slice(0, amtM.index)} ${rest.slice((amtM.index ?? 0) + amtM[0].length)}`.trim();
  }

  // ── HQ state: trailing `based in <state prefix>` — parsed BEFORE `in <state>` ──
  let hqStateName: string | undefined;
  let hqStateCode: string | undefined;
  const basedM = rest.match(/\bbased\s+in\s+([a-z][a-z ]*?)\s*$/);
  if (basedM) {
    const hit = matchState(basedM[1].trim());
    if (hit) {
      hqStateName = hit;
      hqStateCode = STATE_NAME_TO_CODE[hit];
      rest = rest.slice(0, basedM.index).trim();
    }
  }

  // ── PoP state: trailing `in <state prefix>` matched against the canonical names ──
  let stateName: string | undefined;
  let stateCode: string | undefined;
  const inM = rest.match(/\bin\s+([a-z][a-z ]*?)\s*$/);
  if (inM) {
    const hit = matchState(inM[1].trim());
    if (hit) {
      stateName = hit;
      stateCode = STATE_NAME_TO_CODE[hit];
      rest = rest.slice(0, inM.index).trim();
    }
  }

  // ── grain: explicit total/single token(s); absent → both variants ──
  const hasTotal = /\btotal\b/.test(rest);
  const hasSingle = /\bsingle\b/.test(rest);
  rest = rest.replace(/\b(total|single)\b/g, " ").trim();
  const grains: Grain[] =
    hasTotal && !hasSingle ? ["total"] : hasSingle && !hasTotal ? ["single"] : ["total", "single"];

  // ── industry: a leading canonical token (longest-match first for `real estate`) ──
  let industry: string | undefined;
  for (const ind of INDUSTRIES_BY_LEN) {
    if (rest === ind || rest.startsWith(`${ind} `)) {
      industry = ind;
      rest = rest.slice(ind.length).trim();
      break;
    }
  }

  // ── event verbs (Q3): the verb sits where `have won` would, before an optional
  // ` to <job>`. A verb match (and no explicit `won`) flips the sentence to Q3.
  const explicitWon = /\bwon\b/.test(rest);
  const verbSplit = rest.split(/\bto\b/);
  const matchedVerbs = explicitWon ? [] : matchEventVerbs(verbSplit[0] ?? "");

  // ── mode: event verb → Q3; `won`/window → Q2; otherwise Q1 (default) ──
  const mode: Mode = matchedVerbs.length ? "events" : explicitWon || windowTyped ? "won" : "active";

  // ── job phrase: remaining non-filler words as an AND-substring filter. On event
  // rows only the tail after ` to ` is job text (the head is the verb). ──
  const jobSource = mode === "events" ? verbSplit.slice(1).join(" ") : rest;
  const jobTokens = jobSource.split(" ").filter((t) => t && !FILLER.has(t));

  // ── the window fan (Q2 won + Q3 events): one specific window, or all 8 when the
  // sentence is windowed but no window was typed. Q1 (active) has no window. ──
  const windows: (number | undefined)[] =
    mode === "won" || mode === "events"
      ? windowDays != null
        ? [windowDays]
        : WINDOWS.map((w) => w.days)
      : [undefined];

  // ── the labor-need fan: the matching occupation tokens (verbatim fallback when none) ──
  const needs: (string | undefined)[] =
    needPrefix === undefined
      ? [undefined]
      : (() => {
          const toks = needPrefix.split(" ").filter(Boolean);
          const matched = occupations
            .filter((o) => {
              const t = o.token.toLowerCase();
              return toks.every((x) => t.includes(x));
            })
            .sort((a, b) => b.soc_count - a.soc_count)
            .map((o) => o.token);
          return matched.length ? matched : [needPrefix];
        })();

  const out: Command[] = [];
  // On event rows the outer fan is the matched verb(s) and there is NO grain; on
  // Q1/Q2 the outer fan is the grain(s). `head` carries whichever applies.
  const emit = (head: Grain | string, jobPhrase: string | undefined): boolean => {
    for (const win of windows) {
      for (const need of needs) {
        out.push(
          makeCommand({
            mode,
            ...(mode === "events" ? { eventVerb: head } : { grain: head as Grain }),
            industry,
            jobPhrase,
            // PoP state never rides an event row (dropped in makeCommand too).
            stateName: mode === "events" ? undefined : stateName,
            stateCode: mode === "events" ? undefined : stateCode,
            hqStateName,
            hqStateCode,
            minAmt,
            windowDays: win,
            need,
          }),
        );
        if (out.length >= CANDIDATE_CAP) return true;
      }
    }
    return false;
  };

  // Outer fan: the matched event verbs (Q3) or the grain variants (Q1/Q2).
  const heads: (Grain | string)[] = mode === "events" ? matchedVerbs : grains;

  if (jobTokens.length === 0) {
    // No job words typed — the job slot is optional, so the all-work sentences lead,
    // followed by the ENTIRE phrase space (scrollable browse; typing only narrows).
    for (const head of heads) {
      if (emit(head, undefined)) return out;
    }
    const all = [...vocab].sort((a, b) => b.combo_count - a.combo_count);
    for (const p of all) {
      for (const head of heads) {
        if (emit(head, p.phrase)) return out;
      }
    }
    return out;
  }

  const phrases = vocab
    .filter((p) => {
      const hay = phraseHaystack(p.phrase);
      return jobTokens.every((t) => hay.includes(t));
    })
    .sort((a, b) => b.combo_count - a.combo_count);

  for (const p of phrases) {
    for (const head of heads) {
      if (emit(head, p.phrase)) return out;
    }
  }
  return out;
}
