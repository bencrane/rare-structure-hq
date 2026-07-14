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
  | "pact-supply"
  | "cp-thesis"
  | "map-compare"
  | "constr-pie"
  | "sector-pie"
  | "deal-econ"
  | "firm-portrait"
  | "dod-catalyst"
  | "facilities-awards-map"
  | "everything-map"
  | "facilities-56-pie"
  | "middle-band"
  | "facilities-services-pie"
  | "sept-sprint"
  | "sept-oct-cliff"
  | "recovery-steps"
  | "recovery-month"
  | "boring-year"
  | "shutdown-thesis"
  | "estate-map"
  | "dod-split"
  | "hole"
  | "wave-long"
  | "iron-mirage"
  | "iron-book"
  | "iron-dropmic";

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
  beats: [
    {
      id: "ef-sector-pie",
      act: "Act 1 · The standing order",
      title: "$2.26T — the standing order",
      phrase: "all $ by naics sector · 2022-07-04 → 2025-07-03 · snapshot",
      kind: "sector-pie",
    },
    {
      id: "ef-constr-pie",
      act: "Act 1 · The standing order",
      title: "Construction — the historical split",
      phrase: "construction $ by psc-family bucket · fy23–fy25 · snapshot",
      kind: "constr-pie",
    },
    ...EQUIPMENT_YARD.beats.filter((b) => ["thesis-obbba", "wave-obbba"].includes(b.id)),
    {
      id: "wave-obbba-long",
      act: "Act 1 · The thesis",
      title: "The jump — four years of context",
      phrase: "monthly obligations · dhs × horizontal construction · 2022→ · snapshot",
      kind: "wave-long",
    },
    ...EQUIPMENT_YARD.beats.filter((b) => ["money-map", "flow-national"].includes(b.id)),
    {
      id: "iron-mirage",
      act: "Act 2 · The mirage",
      title: "47 firms hold 80% — the mirage",
      phrase: "active heavy-civil awards by firm band · snapshot",
      kind: "iron-mirage",
    },
    {
      id: "iron-book",
      act: "Act 2 · The mirage",
      title: "The middle's book — right now",
      phrase: "490 mid firms · 929 active awards · obligated vs ceiling · snapshot",
      kind: "iron-book",
    },
    {
      id: "iron-dropmic",
      act: "Act 3 · The names",
      title: "We know their names",
      phrase: "mid-market heavy-civil primes · new work since signing · snapshot",
      kind: "iron-dropmic",
    },
  ],
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
      id: "everything-map",
      act: "Act 1 · The floor",
      title: "Everything else the government buys",
      phrase: "fy25 non-s-code $ by pop state · national · snapshot",
      kind: "everything-map",
    },
    {
      id: "facilities-sector-pie",
      act: "Act 1 · The floor",
      title: "The three years before — all sectors",
      phrase: "all $ by naics sector · 2022-07-04 → 2025-07-03 · snapshot",
      kind: "sector-pie",
    },
    {
      id: "facilities-services-pie",
      act: "Act 1 · The floor",
      title: "Inside facility services — $36B",
      phrase: "naics 56 × psc s · $ by psc · 3yr pre-obbba · snapshot",
      kind: "facilities-services-pie",
    },
    {
      id: "facilities-awards-map",
      act: "Act 1 · The floor",
      title: "Real contracts, running right now",
      phrase: "12 named active s-code awards · pop lat/lon · snapshot",
      kind: "facilities-awards-map",
    },
    {
      id: "boring-2021",
      act: "Act 2 · The metronome",
      title: "2021 — month in, month out",
      phrase: "monthly s-code obligations · calendar 2021 · snapshot",
      kind: "boring-year",
    },
    {
      id: "boring-2022",
      act: "Act 2 · The metronome",
      title: "2022 — same twelve bars",
      phrase: "monthly s-code obligations · calendar 2022 · snapshot",
      kind: "boring-year",
    },
    {
      id: "boring-2023",
      act: "Act 2 · The metronome",
      title: "2023 — third year, same story",
      phrase: "monthly s-code obligations · calendar 2023 · snapshot",
      kind: "boring-year",
    },
    {
      id: "boring-2024",
      act: "Act 2 · The metronome",
      title: "2024 — best year yet",
      phrase: "monthly s-code obligations · calendar 2024 · snapshot",
      kind: "boring-year",
    },
    {
      id: "boring-2025",
      act: "Act 2 · The metronome",
      title: "2025 — through September",
      phrase: "monthly s-code obligations · jan–sep 2025 · snapshot",
      kind: "boring-year",
    },
    {
      id: "boring-2025-oct",
      act: "Act 2 · The metronome",
      title: "October — the metronome stops",
      phrase: "monthly s-code obligations · jan–oct 2025 · snapshot",
      kind: "boring-year",
    },
    {
      id: "shutdown-thesis",
      act: "Act 2 · What happened",
      title: "October 1 — the government shut down",
      phrase: "appropriations lapse 2025-10-01 · public record",
      kind: "shutdown-thesis",
    },
    {
      id: "estate-map",
      act: "Act 2 · What happened",
      title: "The estate — buildings, then bases",
      phrase: "federal_sites · gsa buildings + military bases · snapshot",
      kind: "estate-map",
    },
    {
      id: "dod-split",
      act: "Act 2 · What happened",
      title: "Half this market is one buyer",
      phrase: "s-code $ dod vs civilian · fy23–25 · snapshot",
      kind: "dod-split",
    },
    {
      id: "sept-oct-cliff",
      act: "Act 2 · The sprint",
      title: "October 1st — the cliff",
      phrase: "dod obligations · sep vs oct fy22–fy25 · snapshot",
      kind: "sept-oct-cliff",
    },
    {
      id: "recovery-steps",
      act: "Act 2 · The sprint",
      title: "The recovery — except one lane",
      phrase: "dod $ by lane vs fy25 avg · oct→dec 2025 · snapshot",
      kind: "recovery-steps",
    },
    {
      id: "recovery-oct",
      act: "Act 2 · The sprint",
      title: "October — everything hit",
      phrase: "dod $ by lane · oct 2025 vs oct 2024 vs fy25 avg · snapshot",
      kind: "recovery-month",
    },
    {
      id: "recovery-nov",
      act: "Act 2 · The sprint",
      title: "November — hardware first",
      phrase: "dod $ by lane · nov 2025 vs nov 2024 vs fy25 avg · snapshot",
      kind: "recovery-month",
    },
    {
      id: "recovery-dec",
      act: "Act 2 · The sprint",
      title: "December — all but one",
      phrase: "dod $ by lane · dec 2025 vs dec 2024 vs fy25 avg · snapshot",
      kind: "recovery-month",
    },
    {
      id: "facilities-catalyst",
      act: "Act 3 · Here we are",
      title: "Feb 3, 2026 — the money is law",
      phrase: "public law · dod approps $838.7b enacted 2026-02-03 · public record",
      kind: "dod-catalyst",
    },
    {
      id: "facilities-hole",
      act: "Act 3 · Here we are",
      title: "The hole — what the metronome owes",
      phrase: "dod s-code actual vs fy25 pace · oct–jan · snapshot",
      kind: "hole",
    },
    {
      id: "sept-sprint",
      act: "Archive",
      title: "September — $92.4B in thirty days",
      phrase: "dod obligations · september fy22–fy25 · snapshot",
      kind: "sept-sprint",
    },
    {
      id: "middle-band",
      act: "Archive",
      title: "The middle class — 1,379 firms",
      phrase: "naics 56 × psc s · per-firm 3yr book banded · snapshot",
      kind: "middle-band",
    },
    {
      id: "bands-scode",
      act: "Archive",
      title: "Who wins it — the deep middle",
      phrase: "fy25 s-code winners banded by total federal book · snapshot",
      kind: "bands",
    },
    {
      id: "freeze-scode",
      act: "Archive",
      title: "The coiled DoD half",
      phrase: "monthly s-code obligations · dod vs civilian · snapshot",
      kind: "freeze",
    },
    {
      id: "pact-wave",
      act: "Archive",
      title: "PACT — statute to backlog",
      phrase: "monthly obligations · 621111×Q403 va exam lane · snapshot",
      kind: "pact-wave",
    },
    {
      id: "scode-map",
      act: "Archive",
      title: "Every federal site, every state",
      phrase: "fy25 s-code $ by pop state · national · snapshot",
      kind: "scode-map",
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

// ── Narrative 7 · the capital-provider master arc (voiceover-first, WIP) ─────
const CAPITAL_ARC: Narrative = {
  id: "capital-arc",
  title: "The Other Wave",
  audience: "Capital providers / factoring · AR · ABL · equipment finance",
  blurb:
    "The loud trade at the border → the turn → the quiet facilities annuity and the coiled catalyst behind it.",
  status: "draft",
  beats: [
    {
      id: "cp-thesis",
      act: "Act 1 · The signature",
      title: "OBBBA — signed into law",
      phrase: "h.r.1 enrolled text · signed 2025-07-04 · public record",
      kind: "cp-thesis",
    },
    {
      id: "cp-sector-pie",
      act: "Act 1 · Before the bill",
      title: "The three years before — all sectors",
      phrase: "all $ by naics sector · 2022-07-04 → 2025-07-03 · snapshot",
      kind: "sector-pie",
    },
    {
      id: "cp-constr-pie",
      act: "Act 1 · The wave",
      title: "FY23–25 — where the money went",
      phrase: "construction $ by psc-family bucket · fy23–fy25 · snapshot",
      kind: "constr-pie",
    },
    {
      id: "cp-map-compare",
      act: "Act 1 · The wave",
      title: "Before / since — the map",
      phrase: "construction $ by pop state · 12mo before vs since 2025-07-04 · snapshot",
      kind: "map-compare",
    },
    {
      id: "cp-dod-catalyst",
      act: "Act 2 · The catalyst",
      title: "Feb 3, 2026 — the DoD money is law",
      phrase: "public law · dod approps $838.7b enacted 2026-02-03 · public record",
      kind: "dod-catalyst",
    },
    {
      id: "cp-firm-simmons",
      act: "Act 3 · The ground",
      title: "Borrower portrait — Simmons & Golden",
      phrase: "s-code obligations by fy + open awards · uei-level · snapshot",
      kind: "firm-portrait",
    },
    {
      id: "cp-firm-visionquest",
      act: "Act 3 · The ground",
      title: "Borrower portrait — Vision Quest",
      phrase: "s-code obligations by fy + open awards · uei-level · snapshot",
      kind: "firm-portrait",
    },
    {
      id: "cp-firm-gxc",
      act: "Act 3 · The ground",
      title: "Borrower portrait — GXC",
      phrase: "s-code obligations by fy + open awards · uei-level · snapshot",
      kind: "firm-portrait",
    },
    {
      id: "cp-deal-econ",
      act: "Act 3 · The ground",
      title: "Deal economics — one borrower",
      phrase: "derived: 1.75mo float × 90% advance · illustrative $10m federal book",
      kind: "deal-econ",
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
  CAPITAL_ARC,
];

export const getNarrative = (id: string | undefined): Narrative | null =>
  NARRATIVES.find((n) => n.id === id) ?? null;
