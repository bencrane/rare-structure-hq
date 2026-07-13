/**
 * Narrative registry — each narrative is an ASSEMBLAGE OF CARDS (beats) with
 * its own audience and arc. The tour surface renders whichever narrative the
 * URL names (/app/demo/:narrativeId); /app/demo is the gallery.
 *
 * To spin up a new narrative: clone a beats array, drop/add cards, register
 * it here. Cards are shared across narratives — the same money-map or wave
 * card can anchor an equipment-yard pitch and a capital-provider pitch.
 */

export type BeatKind =
  | "aggregate"
  | "territory"
  | "combos"
  | "primes"
  | "thesis"
  | "wave"
  | "flow"
  | "money-map"
  | "facilities-thesis"
  | "scode-map"
  | "bands"
  | "freeze"
  | "pact-wave"
  | "mfg-thesis"
  | "mfg-map"
  | "mfg-coil"
  | "ps-thesis"
  | "ps-map"
  | "ps-coil"
  | "pact-gap"
  | "pact-supply";

export type Beat = {
  id: string;
  /** Act kicker shown above the beat (the narrative arc marker). */
  act: string;
  /** The rail label — what the operator sees while narrating. */
  title: string;
  /** The recipe — a compiler phrase fired verbatim on click, or (for static
   *  stages) the disclosed source line. */
  phrase: string;
  /** Stage renderer. Default "aggregate" (phrase → bars); other kinds render
   *  baked snapshots/layers and fire no query. */
  kind?: BeatKind;
  zip?: string;
};

export type Narrative = {
  id: string;
  /** Gallery card title. */
  title: string;
  /** Who this narrative is for + the claim it builds. */
  audience: string;
  blurb: string;
  status: "active" | "draft";
  beats: Beat[];
};

// ── Narrative 1 · the local equipment yard (79925, border) ───────────────────
const EQUIPMENT_YARD: Narrative = {
  id: "equipment-yard-79925",
  title: "The Border Yard",
  audience: "Equipment yards near the border",
  blurb:
    "OBBBA money → the border wave → their 100-mile territory → the primes and the subs who rent the iron.",
  status: "active",
  beats: [
    {
      id: "thesis-obbba",
      act: "Act 1 · The thesis",
      title: "OBBBA — $46.5B for the border",
      phrase: "h.r.1 enrolled text · signed 2025-07-04 · public record",
      kind: "thesis",
    },
    {
      id: "wave-obbba",
      act: "Act 1 · The thesis",
      title: "The wave — timeline × obligations",
      phrase: "monthly obligations · dhs × horizontal construction · snapshot",
      kind: "wave",
    },
    {
      id: "money-map",
      act: "Act 1 · The thesis",
      title: "Where the money lands — the map",
      phrase: "all new $ since 2025-07-04 by pop state · national · snapshot",
      kind: "money-map",
    },
    {
      id: "flow-national",
      act: "Act 1 · The thesis",
      title: "Where it lands — combos since signing",
      phrase: "new $ by dirt-iron combo since 2025-07-04 · national · snapshot",
      kind: "flow",
    },
    {
      id: "industries-fy23-25",
      act: "Act 1 · The market",
      title: "Total awarded by industry",
      phrase: "total awarded by industry fy23 to fy25",
    },
    {
      id: "territory-79925",
      act: "Act 2 · The yard",
      title: "Where they sit — 79925 · 50 mi",
      phrase: "us albers · 50 mi ring · federal_sites military_base",
      kind: "territory",
      zip: "79925",
    },
    {
      id: "combos-79925-100",
      act: "Act 2 · The yard",
      title: "Top active combos · 100 mi",
      phrase: "top 50 active prime combos near 79925 within 100 miles · snapshot",
      kind: "combos",
    },
    {
      id: "yard-active-79925",
      act: "Act 2 · The yard",
      title: "Active equipment-scope awards near 79925",
      phrase: "total active awards near 79925 within 50 miles by equipment",
    },
    {
      id: "primes-79925-100",
      act: "Act 3 · The flow",
      title: "Top primes → projected sub-out",
      phrase: "top primes near 79925 within 100 miles · fsrs history · snapshot",
      kind: "primes",
    },
  ],
};

// ── Narrative 2 · equipment finance (capital providers) — draft clone ─────────
// Same macro spine, no yard-local anchor yet. Flesh out per-audience beats
// (fleet demand, utilization, collateral value curves) as they're built.
const EQUIPMENT_FINANCE: Narrative = {
  id: "equipment-finance",
  title: "The Iron Wave",
  audience: "Equipment finance / capital providers",
  blurb:
    "OBBBA money → the obligation wave → the dirt-iron combos it lands in — the demand curve behind equipment paper.",
  status: "draft",
  beats: EQUIPMENT_YARD.beats.filter((b) =>
    ["thesis-obbba", "wave-obbba", "money-map", "flow-national"].includes(b.id),
  ),
};

// ── Narrative 3 · janitorial / facilities / cleaning — shell, beats TBD ───────
const FACILITIES: Narrative = {
  id: "facilities-cleaning",
  title: "The Facilities Floor",
  audience: "Janitorial / facilities / cleaning market",
  blurb:
    "A ~$20B/yr structural annuity spread across 7,000+ normal-sized firms — business as usual, until the coiled DoD half releases.",
  status: "draft",
  beats: [
    {
      id: "facilities-thesis",
      act: "Act 1 · The floor",
      title: "The $20B annuity nobody talks about",
      phrase: "psc s-codes · fy25 · structural — no bill required · snapshot",
      kind: "facilities-thesis",
    },
    {
      id: "scode-map",
      act: "Act 1 · The floor",
      title: "Every federal site, every state",
      phrase: "fy25 s-code $ by pop state · national · snapshot",
      kind: "scode-map",
    },
    {
      id: "bands-scode",
      act: "Act 1 · The floor",
      title: "Who wins it — the deep middle",
      phrase: "fy25 s-code winners banded by total federal book · snapshot",
      kind: "bands",
    },
    {
      id: "freeze-scode",
      act: "Act 2 · The spring",
      title: "The coiled DoD half",
      phrase: "monthly s-code obligations · dod vs civilian · snapshot",
      kind: "freeze",
    },
    {
      id: "pact-wave",
      act: "Act 3 · The exam wave",
      title: "PACT — statute to backlog",
      phrase: "monthly obligations · 621111×Q403 va exam lane · snapshot",
      kind: "pact-wave",
    },
  ],
};

// ── Narrative 4 · manufacturing — the DoD procurement coil ────────────────────
const MANUFACTURING: Narrative = {
  id: "manufacturing-coil",
  title: "The Procurement Coil",
  audience: "Manufacturing / defense industrial base",
  blurb:
    "Federal manufacturing is DoD procurement — appropriated at $838.7B, jammed in the pipe. A funding-timing gap, not a demand loss.",
  status: "draft",
  beats: [
    {
      id: "mfg-thesis",
      act: "Act 1 · The base",
      title: "The industrial base runs on one buyer",
      phrase: "naics 31–33 · fy25 · dod-dominated procurement · snapshot",
      kind: "mfg-thesis",
    },
    {
      id: "mfg-map",
      act: "Act 1 · The base",
      title: "Where it's built",
      phrase: "fy25 manufacturing $ by pop state · national · snapshot",
      kind: "mfg-map",
    },
    {
      id: "mfg-coil",
      act: "Act 2 · The coil",
      title: "DoD frozen — appropriated, not obligating",
      phrase: "monthly manufacturing obligations · dod vs civilian · snapshot",
      kind: "mfg-coil",
    },
  ],
};

// ── Narrative 5 · professional services / staffing labor ──────────────────────
const PROFSERVICES: Narrative = {
  id: "profservices-coil",
  title: "The Labor Coil",
  audience: "Professional services / staffing labor",
  blurb:
    "Prof-services is payroll-in-arrears against a −39% DoD freeze while civilian holds flat — the AR-strain / working-capital lane.",
  status: "draft",
  beats: [
    {
      id: "ps-thesis",
      act: "Act 1 · The labor book",
      title: "Federal services is payroll on 45-day terms",
      phrase: "naics 54 · fy25 · dod −39% vs civilian flat · snapshot",
      kind: "ps-thesis",
    },
    {
      id: "ps-map",
      act: "Act 1 · The labor book",
      title: "Where the labor books",
      phrase: "fy25 prof-services $ by pop state · national · snapshot",
      kind: "ps-map",
    },
    {
      id: "ps-coil",
      act: "Act 2 · The coil",
      title: "DoD services frozen, civilian flat",
      phrase: "monthly prof-services obligations · dod vs civilian · snapshot",
      kind: "ps-coil",
    },
  ],
};

// ── Narrative 6 · medical staffing — the PACT exam demand wave ────────────────
const MEDICAL_STAFFING: Narrative = {
  id: "medical-staffing",
  title: "The Exam Backlog",
  audience: "Medical staffing / clinician-labor finance",
  blurb:
    "PACT converted 6.3M veterans into a growing exam-demand base — concentrated in clinician-thin military towns where staffing capacity must be financed up.",
  status: "draft",
  beats: [
    {
      id: "pact-wave",
      act: "Act 1 · The catalyst",
      title: "PACT — statute to backlog",
      phrase: "monthly obligations · 621111×Q403 va exam lane · snapshot",
      kind: "pact-wave",
    },
    {
      id: "pact-gap",
      act: "Act 2 · The gap",
      title: "Demand × supply — the county map",
      phrase: "va disability recipients ÷ exam clinicians by county · snapshot",
      kind: "pact-gap",
    },
    {
      id: "pact-supply",
      act: "Act 3 · The bench",
      title: "Who the primes can leverage",
      phrase: "sam medical & staffing candidates by hq county · snapshot",
      kind: "pact-supply",
    },
  ],
};

export const NARRATIVES: Narrative[] = [
  EQUIPMENT_YARD,
  EQUIPMENT_FINANCE,
  FACILITIES,
  MANUFACTURING,
  PROFSERVICES,
  MEDICAL_STAFFING,
];

export const getNarrative = (id: string | undefined): Narrative | null =>
  NARRATIVES.find((n) => n.id === id) ?? null;
