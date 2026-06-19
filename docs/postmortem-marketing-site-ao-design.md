# Post-Mortem: `marketing-site-ao` Design Churn (PRs #183 → #184 → #185)

**Subject:** The agent's repeated self-reversals designing the "Your Federal Standing"
section and the SectionShell split layout.
**Scope:** `apps/marketing-site-ao` (Vite + React 19 + Tailwind v4, dark institutional theme).
**Evidence basis:** Every claim below is tied to a commit SHA or a current `file:line`.
All three design commits landed the **same evening, 2026-06-18**, inside a **59-minute window**:
- `735ce76` #183 — 20:40:54
- `9e5997b` #184 — 21:30:36
- `2fb89b0` #185 — 21:39:46  ← **9 minutes after #184**

That 9-minute gap is the single loudest fact in this report: the agent shipped a layout
strategy in #184 and reversed its core mechanism in #185 before nine minutes had elapsed.

---

## A) Executive Summary — the indictment

The agent treated a **visual** problem as a **code** problem and never once looked at the
result. It shipped a "balance the split sections" commit (#184, `9e5997b`) built on two
vertical-distribution tricks — `items`-stretch + `mt-auto` bottom-pinning — and reversed
the central one (`mt-auto`) **nine minutes later** in #185 (`2fb89b0`), whose own commit
message admits the trick "opened a void between the two paragraphs." The Government
Contracted card was inflated (wordmark + descriptor + full entity profile + 4-bar
agency breakdown, #184) and then partially gutted (wordmark + descriptor + LIVE header
stripped, #185) inside the same window. Every "balanced / clean / done" claim was inferred
from `tsc` + `vite build` passing and `getBoundingClientRect` arithmetic — the headless
preview never mounted, so **the agent never saw a single pixel it shipped**; the operator's
screenshots were the only visual feedback and always arrived *after* "done." Worst of all, a
design-critic subagent "VERIFIED" the broken centered layout by **measuring vertical
symmetry** — the exact property that produced the floating heading the operator then called
"structurally retarded." The verifier measured the wrong thing and greenlit the defect.
Net result after three PRs and ~59 minutes: the split layout returned to plain top-aligned
flow — **roughly where a first competent pass would have started** — plus residue: two
orphaned icons (`SealIcon`, `CheckIcon`) now dead in `icons.tsx`.

---

## B) Churn Ledger

Legend: ✅ = present in final (`2fb89b0`, current `main`); ❌ = removed; "in-session" =
operator-attested intra-PR state that was churned **before** the squash and therefore is
**not** in git history (see §B2).

| Element | First state | #183 `735ce76` | #184 `9e5997b` | #185 `2fb89b0` | Final | Reversals |
|---|---|---|---|---|---|---|
| Grand serif thesis pull-quote ("…that index, turned outward") | added in-session | **removed in-session** (not in landed #183) | — | — | ❌ | 1 (pre-squash) |
| Faux search field (aria-hidden dead "Search" pill) | added in-session | **removed in-session** (not in landed #183) | — | — | ❌ | 1 (pre-squash) |
| Example-entity chips (Lockheed/Booz/SAIC/Leidos/RTX) | added in-session | **removed in-session** (not in landed #183) | — | — | ❌ | 1 (pre-squash) |
| "Operated by Active Operators" kicker | — | **added** (`PublicUtility.tsx` `panel.kicker`) | **removed** (`site.ts` -`kicker`) | — | ❌ | 2 |
| Capability checklist (5→4 items + `CheckIcon`) | — | **added** (`panel.capabilities`, `CheckIcon`) | **removed** (`-capabilities`) | — | ❌ | 2 |
| "Public access · no authentication" line (factually wrong) | added in-session | **removed in-session** (never in landed copy) | — | — | ❌ | 1 (pre-squash) |
| `Government · Contracted` **wordmark** (+ `SealIcon`) | — | **added** (`panel.wordmark`) | **kept/restored** (moved into header row) | **removed** (`-wordmark`, `-SealIcon import`) | ❌ | 2 (add → remove) |
| Card **descriptor** line | — | **added** (`panel.descriptor`) | kept | **removed** (`-descriptor`) | ❌ | 2 |
| "LIVE" status tag in card header | — | added | kept | **removed** | ❌ | 2 |
| Entity profile (name / UEI-CAGE / badges / 3 stats) | — | — | **added** (`SampleProfile`) | kept (header stripped above it) | ✅ | 0 |
| **Agency-spend breakdown** (4 bars, `AgencyShare[]`) | — | — | **added** (`site.ts` `agencies`, `PublicUtility.tsx:69-91`) | **kept** | ✅ | 0 (see §B2 correction) |
| `mt-auto` bottom-pin (split left column) | top-aligned flow | top-aligned (`children` inline) | **added** (`SectionShell.tsx` `mt-auto … pt-10`) | **removed** (`mt-4`) | ❌ | 2 |
| `items-center` (vertical centering) | — | (n/a in landed) | in-session state | reverted to `items-start` | ❌ | in-session |
| Split vertical alignment | top-aligned | `mt-10` grid, top | stretch + `mt-auto` | `lg:items-start`, top-aligned | top-aligned | 3 (net: round-trip) |
| `lead` type | string | `ReactNode` | **`string \| string[]`** + `leadText` export | kept | ✅ (`string\|string[]`) | over-built for a feature reverted next commit |
| GC CTA | — | **inline text link** (`PublicUtility.tsx:99-110`) | inline link | inline link | ✅ inline | (full-width button only in-session) |
| DeploymentProtocol intro | one paragraph | single `lead` string | **split: lead + `mt-auto` child** (`DeploymentProtocol.tsx:122-127`) | lead + `mt-4` top-aligned child | ✅ two paras, top-aligned | 2 (positioning thrash) |
| Form density (textarea rows / padding) | `rows={4}`, `p-8` | `rows={4}`, `p-8` | `rows={4}`, `p-8` | **`rows={3}`, `p-7`** | trimmed | 1 |

**Quantified waste:** Of ~18 tracked elements, **10 were reversed at least once**; **6 were
added and then removed entirely** (kicker, capabilities/`CheckIcon`, wordmark/`SealIcon`,
descriptor, LIVE tag, `mt-auto`). The `mt-auto` mechanism and the card header are the
egregious cases: each was added in #184 and removed in #185 — a **9-minute lifetime**. The
vertical-alignment strategy round-tripped through ≥3 distinct states and **landed where it
started** (top-aligned normal flow).

**Residue still in the tree (verifiable now):**
- `SealIcon` — defined `icons.tsx:63`, **zero usages** (only consumer was the wordmark,
  removed in #185). Dead code.
- `CheckIcon` — defined `icons.tsx:43`, **zero usages** (only consumer was the capability
  checklist, removed in #184). Dead code.
- `lead?: string | string[]` (`SectionShell.tsx:15`) + the array-mapping `leadNode`
  (`SectionShell.tsx:57-67`) — multi-paragraph support built in #184 to feed the `mt-auto`
  distribution, which was deleted in #185. The complexity outlived its only reason to exist.

---

## B2) Timeline verification — where the operator's account differs from git

The operator's sequence is **substantially accurate**; the squash-merge workflow hides the
intra-PR churn, so several items are real but **not git-attestable**. Corrections:

1. **Items 1–5 (thesis, faux search, entity chips, first-person reframe, "public access /
   no authentication") are NOT in any landed commit.** A search across **all** branches and
   history (`git log --all -p -S "aria-hidden"` and grep for `Lockheed|Booz|SAIC|Leidos|RTX|
   Search`) returns **nothing**. The pre-squash branch tips exist (`2c28a0b`, `4d11baf`,
   `70140f4`) but carry only the final per-PR state, not the working iterations. **Verdict:
   these states are real (operator-attested) but were churned *within* the #183 working
   session before the squash.** They are accurate as behavior, unverifiable as git artifacts.
   The landed #183 (`735ce76`) already shows the *plainer* card: kicker "Operated by Active
   Operators", wordmark, descriptor, a 4-item capability checklist, source line — **no thesis,
   no faux search, no chips, no "public access" line.**

2. **Item 6 ("right side bare" → added full entity-profile mockup): CONFIRMED, but it was
   #184, not a #183 sub-step.** The full `SampleProfile` (name, UEI/CAGE, badges, 3 stats,
   4-row agency breakdown with bars) was added in `9e5997b` (`site.ts` +`SampleProfile`/
   `AgencyShare`; `PublicUtility.tsx:45-91`). In landed #183 the card had **no** entity
   profile — just the capability checklist.

3. **Items 7–8 (trim the card → make it bigger / restore wordmark) are in-session.** The
   landed commits do **not** show a "trim entity+stats to remove agency bars, then re-add
   them" cycle. #184 added the agency bars; #185 kept them. So the "trim agency bars / restore
   agency bars" loop, if it happened, was pre-squash and is not in git.

4. **Item 9 / the "Net" claim is the biggest inaccuracy.** The operator's summary says the
   **agency-breakdown was "ADDED, REMOVED, RE-ADDED, and REMOVED."** Git disagrees: the
   agency breakdown was **added in #184 and is STILL PRESENT in the final state** — see
   `PublicUtility.tsx:69-91` and `site.ts:296-301` on current `main`. What #185 (`2fb89b0`)
   removed was the **card header** (wordmark + descriptor + LIVE tag), *not* the agency bars.
   So: **wordmark / descriptor were add→remove (✅ matches "removed");** **agency-breakdown
   was add-only and survives (✗ does not match "added, removed, re-added, removed").** The
   `SampleProfile` / `AgencyShare` types likewise survive (`site.ts:238-260`).

5. **`items-center` is not in any landed diff.** The landed alignment churn visible in git is
   `mt-10`/top (#183) → `mt-auto`/stretch (#184) → `lg:items-start`/top (#185). The
   `items-center` "floated heading" state the operator describes was an in-session state that
   was already reverted before #184 squashed. Real, but pre-squash.

**Bottom line:** the operator's narrative of *behavior* is correct and damning. The only
factual corrections are bookkeeping: (a) the agency breakdown survived rather than being
removed, and (b) roughly half the described states (thesis, faux search, chips, `items-center`,
"public access") lived and died inside working sessions and never reached a commit — which is
itself evidence of how much blind churn happened off-ledger.

---

## C) Root-Cause Failure Modes

### C1. No visual verification loop — the agent changed pixels blind
**Pattern:** Every layout decision was made and shipped without rendering the page.
**Evidence:** The headless preview (Claude_Preview MCP) never mounted (`#root` empty, blank
screenshots, no console). All "balanced"/"clean"/"done" judgments trace to `tsc --noEmit`
(passes clean today) + `vite build` + `getBoundingClientRect` reasoning. The commit messages
are written in the language of *inferred* geometry, not observed result: #184 claims the left
column "spans the card/form height — heading up top, trailing paragraph aligned to the card's
bottom edge"; #185 then reports that same construction "opened a void between the two
paragraphs." A 9-minute round-trip from "this is the balanced frame" to "this opens a void"
is only possible if **no one looked** between the two commits.
**Why it happened:** The agent accepted a green build as a proxy for a correct design. Builds
verify that code compiles; they say nothing about whether a heading floats or a paragraph
hangs in a void.
**Fix:** A design change is not done until it has been **rendered and seen**. If the renderer
won't mount, that is a P0 blocker on the design task itself (see §D), not a detail to route
around with `getBoundingClientRect`.

### C2. Reactive whack-a-mole — one complaint, one commit, one new defect
**Pattern:** Each operator complaint produced a narrow commit that fixed the named symptom
and introduced the next one.
**Evidence:** "right side looks bare" → inflate card (#184) → "card WAY too big" → strip header
(#185). "looks like ass / centered" (in-session `items-center`) → `mt-auto` distribute (#184)
→ "absolutely awful spacing" → top-align (#185). The fix for each complaint *created the input
to the next complaint*. The two landed reversals (#184 → #185) are the same defect class —
vertical distribution — addressed twice in 9 minutes.
**Why it happened:** The agent optimized to silence the most recent sentence rather than to
satisfy the invariant behind all of them ("the section should look balanced and intentional").
**Fix:** Treat each complaint as a **symptom of a system property**, not a ticket. Before
committing, ask: "does this change make the *other* sections worse, or set up the next
complaint?" One holistic pass beats five reactive ones.

### C3. Treating symptoms (CSS tricks) instead of the root cause (content↔container height mismatch)
**Pattern:** The real problem — the left text column and the right card/form are **different
natural heights** — was attacked four times with vertical-positioning hacks, never by sizing
the two columns to match.
**Evidence:** top-align (void below short text) → `items-center` (floated the heading) →
`items-stretch` + `mt-auto` (`SectionShell.tsx` #184: `<div className="mt-auto … pt-10">`) →
`lg:items-start` top-aligned (#185). Three of four "solutions" were alignment knobs on a grid
whose **two children were never made comparable in height**. #185's own message finally states
the correct principle — "Balance comes from comparable column heights, not vertical
distribution tricks" — and the form trim (`rows={4}→3`, `p-8→p-7`, `DeploymentProtocol.tsx:100,37`)
is the *first* time the agent touched the actual height mismatch.
**Why it happened:** Alignment properties are the first thing that comes to mind for "things
don't line up," and they're cheap to type. The agent reached for the cheap knob repeatedly
instead of diagnosing *why* the columns didn't balance.
**Fix:** When two columns won't balance, the lever is **content volume and container height**
(copy length, card density, padding), not `items-*`/`mt-auto`. Diagnose the height delta first;
adjust the shorter side's content or the taller side's padding.

### C4. Letting content dictate container size (inverted control)
**Pattern:** The card grew and shrank to whatever content the agent felt like adding, and the
layout was bent to accommodate it.
**Evidence:** The operator's own framing — "we control what goes into the card, not the other
way around" — is exactly inverted by #184, which **added** a 4-bar agency breakdown +
3-stat grid + badges + wordmark + descriptor specifically to make the card "substantial
again," then #185 stripped the header back out. The card's height was an *output* of
impulsive content decisions, then the split alignment was repeatedly re-hacked to match that
output.
**Why it happened:** No fixed container contract. The card had no target height/footprint, so
content drove geometry instead of the reverse.
**Fix:** Decide the card's footprint **first** (it should read at roughly the height of the
left column's copy), then curate content to fit it. Container is the constraint; content is
the variable.

### C5. Over-engineering before the fundamentals were right
**Pattern:** Effort went into elaborate copy machinery and a rich data-driven card before the
layout skeleton was even stable.
**Evidence:** Two multi-agent "Workflow judge panels" optimized copy for
"congruence / high-status understatement" (producing "…index, turned outward",
"the data is all public — a pain to pull together") **while the split layout was still
round-tripping through three alignment states.** New typed data structures —
`SampleProfile`, `AgencyShare`, `ProfileStat`, `lead: string | string[]` + exported
`leadText` (`site.ts:238-265`, `SectionShell.tsx:15,29`) — were stood up in #184 to feed a
distribution layout that was deleted in #185. The polish ran ahead of the structure.
**Why it happened:** Polishing copy and inventing data schemas is more satisfying than
sitting with an unsolved layout. The agent did the fun part first.
**Fix:** **Skeleton before skin.** Lock the layout (columns, alignment, container heights)
and verify it visually before writing a word of finished copy or a line of decorative data
modeling. Abstractions (`string | string[]`) are earned by a stable requirement, not
speculation.

### C6. A verification subagent that measured the wrong property and greenlit a defect
**Pattern:** The agent delegated verification to a design-critic subagent that confirmed
*symmetry*, which is precisely the property the broken layout had.
**Evidence:** The critic "VERIFIED" the `items-center` version as balanced by measuring
symmetric whitespace ("leftTop 288 / leftBottom 287"). Equal top/bottom whitespace **is**
vertical centering — and vertical centering is what floated the section label and heading into
the middle, which the operator then called "structurally retarded." The verifier confirmed the
defect by measuring the defect's defining trait and reporting it as success.
**Why it happened:** The check encoded a wrong definition of "balanced" (symmetry) instead of
the actual requirement (heading anchored top, intentional structure, no floating). Automated
verification inherits the blindness of whoever wrote the metric.
**Fix:** Verification must assert the **requirement**, not a proxy that happens to be easy to
measure. For "is this section visually balanced?" the only valid check is a human-or-vision
look at the rendered page. A geometric metric is acceptable only when it provably encodes the
requirement (e.g. "heading top-edge is within Npx of the card top-edge"), never "the
whitespace is symmetric."

### C7. Declaring "done / clean / balanced" on green-build evidence alone
**Pattern:** Completion was claimed from compilation, not from the artifact.
**Evidence:** Three commits in 59 minutes, each declared resolved, each overturned by the
next or by the operator's after-the-fact screenshot. `tsc --noEmit` passes on the final tree
*and passed at every step* — including the steps the operator immediately rejected. The build
was green for the floated heading, green for the `mt-auto` void, and green for the top-aligned
fix. The signal carried zero design information.
**Why it happened:** "It compiles and the math says it's centered" was treated as "it looks
right." Those are different claims; only the build one was tested.
**Fix:** Forbid "done/clean/balanced" on a design task unless accompanied by a rendered
screenshot the agent actually inspected, or an explicit deferral to the operator (§D). Green
build → "compiles," never → "looks right."

---

## D) The Verification Gap — in depth

**Why "build passes + DOM math" is not verification for design.** A passing `tsc`/`vite build`
proves the code is *valid*, not that the page is *correct*. `getBoundingClientRect` arithmetic
is worse than useless here: it gave the agent false confidence by producing numbers ("288 /
287") that *looked* like evidence while encoding the wrong success criterion (§C6). Design
quality is a property of rendered pixels — kerning, balance, whether a heading floats, whether
a paragraph hangs in a void. None of that is observable from the type checker or from a
rectangle's coordinates. Every defect the operator caught (floated heading, `mt-auto` void,
bare card, oversized card) was invisible to the build and visible at a glance in a screenshot.

**What the agent should have done when the headless browser wouldn't mount.** In priority order:
1. **Fix the tooling first.** A design task whose verification tool is down is *blocked*, not
   *proceed-anyway*. Diagnose the empty `#root` (dev server URL, base path, hydration error,
   MCP wiring) and get one real screenshot before touching layout.
2. **Use an alternate renderer.** Local `vite dev` + a different headless capture
   (`gstack`/`browse`, Playwright, even a manual screenshot), or open the built `dist/` in any
   browser. There is more than one way to see a page.
3. **If you genuinely cannot see it, refuse to claim visual quality.** Say so explicitly:
   "Layout changed; I could not render it; needs an operator screenshot to confirm." Make
   the absence of verification a stated, visible gap — never paper over it with `tsc` green
   and DOM math and the word "balanced."

**Hard rule for design work on this repo:**
> No commit that changes layout, spacing, alignment, or component composition may be described
> as "balanced," "clean," "done," or "fixed" unless (a) the change was rendered and the agent
> inspected the screenshot, or (b) the message explicitly states it is unverified and defers to
> the operator. `tsc`/`vite build` passing is a *precondition*, never the verification.

---

## E) Process — so this never repeats

### Pre-flight checklist (run before any design iteration on `marketing-site-ao`)
1. **Establish the reference first.** `Hero.tsx` is the canonical split. It has been
   **top-aligned the entire time**: `grid … lg:grid-cols-[1.08fr_0.92fr]` on a
   `flex min-w-0 flex-col` left column (`Hero.tsx:17-18`), `Eyebrow tone="accent"`,
   `max-w-[34rem]` copy. **Every split section must mirror the hero exactly.** #184's message
   even claims it is "mirroring the hero's text+panel grid" — yet the hero never used
   `items-center` or `mt-auto`. The reference was *right there* and was overridden anyway.
   Read the reference before changing the thing that's supposed to match it.
2. **Confirm the renderer mounts before editing.** Get one screenshot of the current state.
   If `#root` is empty, that's the task until it's fixed (§D). No blind edits.
3. **Size containers, then curate content (§C4).** Decide the card/form footprint up front
   (≈ left-column copy height). Then fill it. Do not grow content and bend the layout to it.
4. **One holistic pass, not per-complaint commits (§C2).** Collect the full set of issues,
   design one coherent fix across all split sections (they share `SectionShell`), implement,
   render, *then* commit. `PublicUtility` and `DeploymentProtocol` are the same layout — fix
   them together, never one symptom at a time.
5. **See every change before claiming it (§C1, §D).** Screenshot → inspect → only then write
   "balanced/done." Otherwise write the explicit deferral.
6. **Stop reversing.** If you have removed an element once (wordmark, kicker, capabilities,
   `mt-auto`), **do not re-add it without a written reason** in the commit body stating what
   changed since the removal. The 9-minute `mt-auto` add/remove and the wordmark add/remove
   would both have been caught by this single rule.

### Codebase-specific working agreement
- **`SectionShell` split contract (`SectionShell.tsx:78-89`) is law.** It now encodes the hard
  lesson directly in its doc comment (lines 38-41): *"top-aligned … not from vertical
  distribution tricks (centering floats the heading; mt-auto opens a void)."* Do not
  re-introduce `items-center` or `mt-auto` on the split left column. If a section looks
  unbalanced, adjust **copy length or aside height/padding**, not alignment.
- **Hero is the reference, not a thing to redesign.** Match it; don't fork it.
- **Use the Tailwind tokens and the shared primitives.** `Eyebrow` (one label style site-wide,
  `Eyebrow.tsx`), `leadText` (`SectionShell.tsx:29`), the `--color-*` CSS vars. Do not
  hand-roll a heading/label in a section file — the shell owns it.
- **Earn abstractions.** `lead: string | string[]` exists to serve a distribution layout that
  was deleted. Before generalizing a prop, confirm two real consumers need it.
- **Clean up residue.** `SealIcon` (`icons.tsx:63`) and `CheckIcon` (`icons.tsx:43`) are dead
  after #185 removed their only consumers — delete them. Churn that leaves orphans is churn
  that wasn't finished.

---

## F) What actually worked (signal, for calibration)

Short, because this is a failure post-mortem — but real:
- **The SectionShell single-source refactor (#183, `735ce76`).** Consolidating the split/heading/
  lead/gutters into one component (`SectionShell.tsx`) and migrating `DeploymentProtocol` +
  `PublicUtility` onto it was the right architecture. It is *why* a later layout fix touched
  one file instead of two. (The mistake was iterating its *behavior* blind — not the
  refactor itself.)
- **Eyebrow / section-label unification (#183).** Deleting `SectionLabel.tsx` (confirmed gone)
  and standardizing every section on the hero's dotted `Eyebrow` (`Eyebrow.tsx`, top-aligned
  by construction) removed a real inconsistency and gave the page one label language.
- **The network-POV pillar rewrite (#183, `site.ts:147-159`).** Re-voicing the three pillars
  ("Structural Allocation," "Specialized Resolution," "Execution Velocity") into a
  network-perspective register, dropping agency-stripping second-person framing, was a clean,
  defensible copy improvement that did not get reversed.
- **The form-trim diagnosis (#185).** `rows={4}→3`, `p-8→p-7` (`DeploymentProtocol.tsx:100,37`)
  was the *first* change that addressed the actual root cause (column-height mismatch, §C3)
  rather than an alignment knob. It just arrived after four detours.

---

### One-line verdict
The architecture decisions were sound; the **iteration discipline was absent** — the agent
shipped design changes it could not see, reversed itself in 9-minute cycles, and let an
automated verifier confirm the very defect it was supposed to catch. Fix the loop (render →
see → claim), not the talent.
