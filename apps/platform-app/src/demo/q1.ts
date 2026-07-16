/**
 * Q1 canonical-query typeahead — the pure completion logic behind the ⌘K palette.
 *
 * THE TWO APPROVED SHAPES:
 *   Q1 (active): [<industry> ]companies with active {total|single} awards[ to <job>]
 *                [ billing <family>][ with|without progress payments][ in <state>]
 *                [ based in <state>][ over $X][ and need <occupation>]
 *   Q2 (won):    [<industry> ]companies that have won {total|single} awards[ to <job>]
 *                [ billing <family>][ with|without progress payments][ in <state>]
 *                [ based in <state>][ over $X] in the last <window>[ and need <occupation>]
 *
 * `billing <family>` (fixed price | cost plus | time and materials) and `with|without
 * progress payments` are award-latest-state slots — Q1/Q2 only. `in <state>` is
 * place-of-performance; `based in <state>` is HQ. The grain marker
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

/** The 3 canonical billing (pricing-family) tokens — the optional `billing <family>` slot on
 * Q1/Q2 (award-latest-state pricing). Sent verbatim as `billing`; the edge maps each to its
 * FPDS pricing-code set. `time and materials` is the only multi-word-ambiguous token, but the
 * required leading `billing ` keyword disambiguates all three. */
export const BILLING_TERMS = ["fixed price", "cost plus", "time and materials"] as const;
type BillingTerm = (typeof BILLING_TERMS)[number];

/** The 2 canonical financing tokens — the optional `with|without progress payments` slot on
 * Q1/Q2 (award-latest-state financing). Sent verbatim as `financing`; the edge maps each to
 * its FPDS financing-code set (NULL financing counts as "without"). */
type FinancingTerm = "with progress payments" | "without progress payments";

/** Q3 EVENT VERBS (approved 2026-07-15) — the FPDS-modification-event sentence family:
 * "[<industry> ]companies that <event verb>[ to <job>][ in <state>][ based in <state>]
 *  [ over $X] in the last <window>[ and need <token>]". Each verb maps server-side to an
 * action_type_code set (2 are rollups). There is NO total/single grain marker and the
 * window is REQUIRED. The `in <state>` (PoP) slot IS offered — the edge routes state on
 * events to the PoP-dimensioned mart. The verb string is sent verbatim as `eventVerb`;
 * the edge does the code mapping. `and need` / `over $X` still apply. */
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

/** Q4 STEP-GROWTH (approved 2026-07-15) — the acceleration sentence family:
 * "[<industry> ]companies whose prime obligations grew {2x|3x|4x|5x|10x}
 *  in the last {12 months vs the prior 24 months | 6 months vs the prior 12 months |
 *  90 days vs the prior 90 days}[ to <job>][ in <state>][ based in <state>][ and need <token>]".
 * Per company Σ obligations in the recent window A ≥ N × Σ in the immediately-preceding
 * window B, with Σ B > 0. There is NO total/single grain, NO `over $X`, and NO percent
 * language. The `in <state>` (PoP) slot IS offered — the edge routes state on growth to
 * the PoP-dimensioned mart (summing all action types). `multiplier` + `windowPair` are
 * sent to the edge. */
const GROWTH_MULTIPLIERS = [2, 3, 4, 5, 10] as const;

type WindowPair = "12v24" | "6v12" | "90v90";

/** The 3 approved growth window pairs: key ⊕ the clause rendered after `grew {N}x `, plus
 * the confident fragments that pin the pair when typed (anything else fans all 3). */
export const GROWTH_WINDOW_PAIRS: { key: WindowPair; render: string; frags: string[] }[] = [
  {
    key: "12v24",
    render: "in the last 12 months vs the prior 24 months",
    frags: ["12v24", "prior 24", "24 month"],
  },
  {
    key: "6v12",
    render: "in the last 6 months vs the prior 12 months",
    frags: ["6v12", "prior 12", "6 month"],
  },
  {
    key: "90v90",
    render: "in the last 90 days vs the prior 90 days",
    frags: ["90v90", "90 day", "90"],
  },
];

/** Render the growth window-pair clause exactly as it reads in the sentence. */
export function renderGrowthWindowPair(key: WindowPair): string {
  return GROWTH_WINDOW_PAIRS.find((w) => w.key === key)?.render ?? "";
}

/** Resolve a typed fragment to one of the 3 canonical window pairs (undefined = fan all 3). */
export function matchGrowthWindowPair(text: string): WindowPair | undefined {
  const t = text.toLowerCase();
  return GROWTH_WINDOW_PAIRS.find((w) => w.frags.some((f) => t.includes(f)))?.key;
}

/** Resolve a typed `4x` / `10 x` shorthand to one of the 5 canonical multipliers
 * (undefined = none typed → fan all 5). Off-set values (e.g. `7x`) do not pin. */
export function matchGrowthMultiplier(text: string): number | undefined {
  const m = text.match(/\b(\d+)\s*x\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return (GROWTH_MULTIPLIERS as readonly number[]).includes(n) ? n : undefined;
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
type Mode = "active" | "won" | "events" | "growth";

/** The resolved slots behind one candidate sentence. */
type Slots = {
  mode: Mode;
  /** Absent on event verbs (Q3) and step-growth (Q4) — neither carries a grain marker. */
  grain?: Grain;
  eventVerb?: string;
  /** Q4 step-growth multiplier (2/3/4/5/10) — present only when `mode === "growth"`. */
  multiplier?: number;
  /** Q4 step-growth window pair — present only when `mode === "growth"`. */
  windowPair?: WindowPair;
  industry?: string;
  jobPhrase?: string;
  stateName?: string;
  stateCode?: string;
  hqStateName?: string;
  hqStateCode?: string;
  /** Q1/Q2 award-latest-state pricing family — `billing <family>`. */
  billing?: BillingTerm;
  /** Q1/Q2 award-latest-state financing — `with|without progress payments`. */
  financing?: FinancingTerm;
  minAmt?: number;
  windowDays?: number;
  need?: string;
};

/** Render the full Q1 (active) / Q2 (won) / Q3 (events) / Q4 (growth) sentence from
 * resolved slots. */
export function q1Sentence(slots: Slots): string {
  const {
    mode,
    grain,
    eventVerb,
    multiplier,
    windowPair,
    industry,
    jobPhrase,
    stateName,
    hqStateName,
    billing,
    financing,
    minAmt,
    windowDays,
    need,
  } = slots;
  // Q4 step-growth reads on its own axis: grew {N}x over the recent-vs-prior window pair.
  // No grain, no `over $X`, no billing/financing. `in <state>` (PoP) IS offered.
  if (mode === "growth") {
    let g = industry ? `${industry} ` : "";
    g += `companies whose prime obligations grew ${multiplier}x`;
    g += ` ${renderGrowthWindowPair(windowPair ?? "12v24")}`;
    if (jobPhrase) g += ` ${renderJobPhrase(jobPhrase)}`;
    if (stateName) g += ` in ${stateName}`;
    if (hqStateName) g += ` based in ${hqStateName}`;
    if (need) g += ` and need ${need}`;
    return g;
  }
  let s = industry ? `${industry} ` : "";
  s +=
    mode === "events"
      ? `companies that ${eventVerb}`
      : mode === "won"
        ? `companies that have won ${grain} awards`
        : `companies with active ${grain} awards`;
  if (jobPhrase) s += ` ${renderJobPhrase(jobPhrase)}`;
  // Canonical order: awards [to job] [billing X] [with/without progress payments] [in
  // state] [based in state] [over $X]. billing/financing ride Q1/Q2 only (award grain).
  if (billing) s += ` billing ${billing}`;
  if (financing) s += ` ${financing}`;
  // `in <state>` (PoP) is now offered on event verbs too — the edge routes it to the
  // PoP-dimensioned mart.
  if (stateName) s += ` in ${stateName}`;
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
    multiplier,
    windowPair,
    industry,
    jobPhrase,
    stateCode,
    hqStateCode,
    billing,
    financing,
    minAmt,
    windowDays,
    need,
  } = slots;
  const windowed = mode === "won" || mode === "events";
  // No grain on event verbs (Q3) or step-growth (Q4). billing/financing are award-latest-
  // state (award grain) → Q1/Q2 only; the $ floor / won-window never ride a growth row.
  const noGrain = mode === "events" || mode === "growth";
  return {
    id: `q1:${mode}:${grain ?? ""}:${eventVerb ?? ""}:${multiplier ?? ""}:${windowPair ?? ""}:${industry ?? ""}:${jobPhrase ?? ""}:${stateCode ?? ""}:${hqStateCode ?? ""}:${billing ?? ""}:${financing ?? ""}:${minAmt ?? ""}:${windowDays ?? ""}:${need ?? ""}`,
    kind: "active-awards",
    label: q1Sentence(slots),
    ...(noGrain ? {} : { grain }),
    ...(mode !== "active" ? { mode } : {}),
    ...(mode === "events" && eventVerb ? { eventVerb } : {}),
    ...(mode === "growth" && multiplier != null ? { multiplier } : {}),
    ...(mode === "growth" && windowPair ? { windowPair } : {}),
    ...(windowed && windowDays != null ? { windowDays } : {}),
    ...(jobPhrase ? { jobPhrase } : {}),
    // PoP state is now bound on every mode (events/growth route it to the PoP mart).
    ...(stateCode ? { stateCode } : {}),
    ...(hqStateCode ? { hqState: hqStateCode } : {}),
    ...(industry ? { industry } : {}),
    ...(need ? { need } : {}),
    // billing/financing ride Q1/Q2 only (award grain); dropped on events/growth.
    ...(billing && !noGrain ? { billing } : {}),
    ...(financing && !noGrain ? { financing } : {}),
    ...(mode === "growth" ? {} : minAmt != null ? { minAmt } : {}),
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
 * Slots are extracted from the trailing end inward (each removed before the next is parsed),
 * with the distinctive-keyword billing/financing slots stripped first (they may sit anywhere):
 *   `billing <family>`             → pricing family, Q1/Q2 (fixed price|cost plus|time and materials),
 *   `with|without progress payments` → financing arrangement, Q1/Q2,
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

  // ── Q4 step-growth: `grew` (or a bare multiplier like `4x`) flips the sentence to the
  // growth family — a self-contained composer path (its own window vocabulary, no grain,
  // no PoP, no $ floor). Detected before the Q1/Q2/Q3 slot parser touches `text`. ──
  if (/\bgrew\b/.test(text) || /\b\d+\s*x\b/.test(text)) {
    return growthCandidates(text, vocab, occupations);
  }

  let rest = text;

  // ── billing (Q1/Q2 pricing family): `billing <family>` — distinctive keyword, matched
  // anywhere after the awards clause and stripped before the trailing-slot parses run. ──
  let billing: BillingTerm | undefined;
  const billM = rest.match(/\bbilling\s+(fixed price|cost plus|time and materials)\b/);
  if (billM) {
    billing = billM[1] as BillingTerm;
    rest =
      `${rest.slice(0, billM.index)} ${rest.slice((billM.index ?? 0) + billM[0].length)}`.trim();
  }

  // ── financing (Q1/Q2): `with|without progress payments` — the `progress payments` tail
  // disambiguates from the `companies with active` opener; matched anywhere and stripped. ──
  let financing: FinancingTerm | undefined;
  const finM = rest.match(/\b(with|without)\s+progress\s+payments\b/);
  if (finM) {
    financing = `${finM[1]} progress payments` as FinancingTerm;
    rest = `${rest.slice(0, finM.index)} ${rest.slice((finM.index ?? 0) + finM[0].length)}`.trim();
  }

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
            // PoP state now rides every mode (events routes it to the PoP mart).
            stateName,
            stateCode,
            hqStateName,
            hqStateCode,
            // billing/financing are award-latest-state → Q1/Q2 only (dropped on events).
            billing: mode === "events" ? undefined : billing,
            financing: mode === "events" ? undefined : financing,
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

/**
 * Compose the Q4 step-growth candidate rows for the current palette input.
 *
 * Slots (each removed from the tail before the next is parsed, mirroring q1Candidates):
 *   `and need <occupation prefix>` → labor need,
 *   `based in <state>`             → HQ state (parsed BEFORE `in <state>`),
 *   `in <state>`                   → place-of-performance state (routes to the PoP mart),
 *   ` to <job>`                    → job phrase (AND-substring filter over the vocab),
 *   a leading industry token       → the industry vertical,
 *   a `{N}x` fragment              → the multiplier (fans all 5 when none is pinned),
 *   a window-pair fragment         → the window pair (fans all 3 when none is pinned).
 *
 * There is NO grain and NO `over $X`. `in <state>` (PoP) IS offered — the edge routes it
 * to the PoP-dimensioned mart. The multiplier × window-pair × need fan is capped at
 * `CANDIDATE_CAP`.
 */
function growthCandidates(text: string, vocab: JtbdPhrase[], occupations: Occupation[]): Command[] {
  let rest = text;

  // ── labor need: trailing `[and ]need <occupation prefix>` ──
  let needPrefix: string | undefined;
  const needM = rest.match(/\b(?:and\s+)?need\b\s*(.*)$/);
  if (needM) {
    needPrefix = needM[1].trim();
    rest = rest.slice(0, needM.index).trim();
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

  // ── PoP state: trailing `in <state prefix>` — now offered on growth (the edge routes it
  // to the PoP-dimensioned mart). The window clause carries digits, so `[a-z ]` can never
  // false-match "in the last 12 months …" — only a genuine trailing state name matches. ──
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

  // ── window pair: a confident fragment pins one, else the sentence fans all 3 ──
  const windowPair = matchGrowthWindowPair(rest);

  // ── job phrase: only the tail after ` to ` is job text (the head is the growth scaffolding
  // + window clause, which carries no ` to `). ──
  const toIdx = rest.indexOf(" to ");
  const head = toIdx >= 0 ? rest.slice(0, toIdx) : rest;
  const jobSource = toIdx >= 0 ? rest.slice(toIdx + 4) : "";

  // ── multiplier: a `{N}x` fragment pins one, else the sentence fans all 5 ──
  const multiplier = matchGrowthMultiplier(head) ?? matchGrowthMultiplier(text);

  // ── industry: a leading canonical token (longest-match first for `real estate`) ──
  let industry: string | undefined;
  for (const ind of INDUSTRIES_BY_LEN) {
    if (head === ind || head.startsWith(`${ind} `)) {
      industry = ind;
      break;
    }
  }

  const jobTokens = jobSource.split(" ").filter((t) => t && !FILLER.has(t));

  const multipliers: number[] = multiplier != null ? [multiplier] : [...GROWTH_MULTIPLIERS];
  const windowPairs: WindowPair[] =
    windowPair != null ? [windowPair] : GROWTH_WINDOW_PAIRS.map((w) => w.key);

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
  const emit = (jobPhrase: string | undefined): boolean => {
    for (const mult of multipliers) {
      for (const wp of windowPairs) {
        for (const need of needs) {
          out.push(
            makeCommand({
              mode: "growth",
              multiplier: mult,
              windowPair: wp,
              industry,
              jobPhrase,
              stateName,
              stateCode,
              hqStateName,
              hqStateCode,
              need,
            }),
          );
          if (out.length >= CANDIDATE_CAP) return true;
        }
      }
    }
    return false;
  };

  if (jobTokens.length === 0) {
    // No job words typed — lead with the all-work sentences, then the full phrase space.
    if (emit(undefined)) return out;
    const all = [...vocab].sort((a, b) => b.combo_count - a.combo_count);
    for (const p of all) {
      if (emit(p.phrase)) return out;
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
    if (emit(p.phrase)) return out;
  }
  return out;
}
