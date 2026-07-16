/**
 * Q1 canonical-query typeahead — the pure completion logic behind the ⌘K palette.
 *
 * THE Q1 SENTENCE (the only approved shape):
 *   companies with active {total|single} awards[ {job phrase}][ in {state}][ over ${amount}]
 *
 * The grain marker (`total`/`single`) is REQUIRED; every slot after it is optional.
 * Candidates are composed CLIENT-SIDE from the canonical vocabulary — the full
 * cross-product is never pre-generated. The palette calls `q1Candidates` on every
 * keystroke and caps the list; only a completed sentence is a runnable Q1 row.
 */

import type { JtbdPhrase } from "./federalApi";
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
const FILLER = new Set(["companies", "with", "active", "awards", "award", "in", "the"]);

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

/** Render the full Q1 sentence from resolved slots. */
export function q1Sentence(
  grain: "total" | "single",
  jobPhrase: string | undefined,
  stateName: string | undefined,
  minAmt: number | undefined,
): string {
  let s = `companies with active ${grain} awards`;
  if (jobPhrase) s += ` ${renderJobPhrase(jobPhrase)}`;
  if (stateName) s += ` in ${stateName}`;
  if (minAmt != null) s += ` over ${formatAmount(minAmt)}`;
  return s;
}

function makeCommand(
  grain: "total" | "single",
  jobPhrase: string | undefined,
  stateName: string | undefined,
  stateCode: string | undefined,
  minAmt: number | undefined,
): Command {
  return {
    id: `q1:${grain}:${jobPhrase ?? ""}:${stateCode ?? ""}:${minAmt ?? ""}`,
    kind: "active-awards",
    label: q1Sentence(grain, jobPhrase, stateName, minAmt),
    grain,
    ...(jobPhrase ? { jobPhrase } : {}),
    ...(stateCode ? { stateCode } : {}),
    ...(minAmt != null ? { minAmt } : {}),
  };
}

const CANDIDATE_CAP = 40;
const EMPTY_TOP_N = 20;

/**
 * Compose the Q1 candidate rows for the current palette input.
 *
 * Empty input → the top `EMPTY_TOP_N` phrases by `combo_count`, each as a `total`-grain
 * sentence. Otherwise the input is parsed slot-by-slot: a trailing `over $<amt>` → the
 * obligation floor, a trailing `in <state prefix>` → the state, an explicit `total`/`single`
 * token → the grain (both variants when absent), and the remaining non-filler words filter
 * the vocabulary by substring. The result is capped at `CANDIDATE_CAP`.
 */
export function q1Candidates(raw: string, vocab: JtbdPhrase[]): Command[] {
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (!text) {
    return [...vocab]
      .sort((a, b) => b.combo_count - a.combo_count)
      .slice(0, EMPTY_TOP_N)
      .map((p) => makeCommand("total", p.phrase, undefined, undefined, undefined));
  }

  let rest = text;

  // ── amount: trailing `over $<amt>` (parsed first so `in <state>` becomes trailing) ──
  let minAmt: number | undefined;
  const amtM = rest.match(/\bover\s*\$?\s*(\d+(?:\.\d+)?)\s*([kmb])?\b/);
  if (amtM) {
    minAmt = parseAmount(amtM[1], amtM[2]);
    rest = `${rest.slice(0, amtM.index)} ${rest.slice((amtM.index ?? 0) + amtM[0].length)}`.trim();
  }

  // ── state: trailing `in <state prefix>` matched against the canonical names ──
  let stateName: string | undefined;
  let stateCode: string | undefined;
  const inM = rest.match(/\bin\s+([a-z][a-z ]*?)\s*$/);
  if (inM) {
    const prefix = inM[1].trim();
    // Longest canonical name that the typed prefix begins, or that begins the prefix.
    const hit = STATE_NAMES.filter((n) => n.startsWith(prefix) || prefix.startsWith(n)).sort(
      (a, b) => b.length - a.length,
    )[0];
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
  const grains: ("total" | "single")[] =
    hasTotal && !hasSingle ? ["total"] : hasSingle && !hasTotal ? ["single"] : ["total", "single"];

  // ── job phrase: remaining non-filler words as an AND-substring filter ──
  const jobTokens = rest.split(" ").filter((t) => t && !FILLER.has(t));

  const out: Command[] = [];
  if (jobTokens.length === 0) {
    // No job phrase typed — the slot is optional; offer the grain (+ state/amount) sentence.
    for (const grain of grains) {
      out.push(makeCommand(grain, undefined, stateName, stateCode, minAmt));
    }
    return out.slice(0, CANDIDATE_CAP);
  }

  const phrases = vocab
    .filter((p) => {
      const hay = phraseHaystack(p.phrase);
      return jobTokens.every((t) => hay.includes(t));
    })
    .sort((a, b) => b.combo_count - a.combo_count);

  for (const p of phrases) {
    for (const grain of grains) {
      out.push(makeCommand(grain, p.phrase, stateName, stateCode, minAmt));
      if (out.length >= CANDIDATE_CAP) return out;
    }
  }
  return out;
}
