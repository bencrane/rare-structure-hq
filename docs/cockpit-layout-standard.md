# Cockpit Layout Standard

Adversarial review of the authenticated `/app/*` cockpit shell (PRs #23–#27) and the
binding standard for every structural layout that follows. Scope: `apps/platform-app`.
The design system under review: `packages/tokens`, `packages/ui`.

Verdict up front: the rebuild (`2f1af7c`) moved the **sidebar** onto the primitives and
that part is now mostly systematic. Everything the sidebar wraps — `cockpit.tsx`,
`SignIn.tsx`, the route pages — is still hand-coded with arbitrary spacing, arbitrary
type sizes, and a brand face that never actually renders. The method that produced this
(build first, react to "looks cramped," nudge one utility) is the root cause and it is
still live in the rest of the app. The cockpit also shipped two real regressions during
the "systematic" rewrite: the page-title face silently fell back to Geist **Sans**, and
the brand/status pairing got split across two surfaces leaving a lonely `LIVE` readout.

---

## 1. METHOD CRITIQUE — why "build → react → nudge" manufactures magic numbers

### 1.1 The trail, from git

| Commit | What happened | Spacing introduced |
|---|---|---|
| `8f6a3f9` (#23) | Sidebar built from scratch, patterned on outbound-solutions. | `gap-0.5`, `px-5 py-5`, `py-2`, `size-7`, `gap-2.5`, `pl-[2.375rem]`, `text-[0.625rem]`, `text-[0.6875rem]`, `tracking-[0.16em]`/`[0.18em]` — **all hand-coded, none through a primitive.** |
| `dcfefa6` (#24) | Collapsible + Map default. | More conditional utilities (`p-2.5`, `justify-center`). |
| `d22f317` (#25) | Dropped the map's brand header when embedded. | Introduced the split-brand regression (see 1.4). |
| `e95c717` (#26) | "Open up the cockpit sidebar nav spacing." Reaction to "looks cramped." | `gap-0.5 → gap-1.5`, `py-2 → py-2.5`, added `pt-8 pb-4`. **`1.5` and `2.5` are off the token scale entirely** (scale: 0,1,2,3,4,5,6,8,10,12,16,20,24). |
| `2f1af7c` | "Rebuild the cockpit sidebar on the design system." Reaction to "do not handcode it." | Commit message itself admits: *"Stop hand-tuning utility values (py-2.5, gap-1.5, text-[0.625rem] — most of them off the token scale entirely)."* |

The teammate's own rebuild commit is a confession. The off-scale values in #26 are not a
typo; they are the **inevitable output of the loop**, and #26 is the cleanest possible
demonstration of it: the operator said "cramped," the response was to open one gap and one
padding by a quarter-step each, and the only quarter-steps available are off-scale
(`1.5 = 6px`, `2.5 = 10px`). The scale has no 6px gap or 10px padding **on purpose** —
it jumps 8→12→16. Reactive nudging has nowhere to land except between the rungs.

### 1.2 Why the loop *structurally* produces off-scale values

1. **The feedback signal is analog, the scale is discrete.** "Cramped" is a continuous
   perception. The fix space is a 13-step ladder. When 8px reads tight and 12px reads
   loose, a person tuning by eye reaches for 10px — which does not exist. The loop has no
   mechanism that says "round to the nearest rung and re-evaluate the *relationship*, not
   the absolute gap."
2. **No layout contract means every value is decided locally.** There was never a written
   answer to "what token step is a nav row's vertical padding?" So each row's padding was
   invented at the moment it looked wrong, in isolation from card padding, section gap, and
   page gutter. Nothing forced them to relate.
3. **Hand-coded scaffolds invite hand-coded spacing.** #23 built the sidebar as raw
   `<div>`/`<nav>`/`<button>` with inline className. Once you are already typing
   `className="... py-2 ..."`, typing `py-2.5` is frictionless. The primitives were not in
   the call path, so the token scale was not in the call path. **The escape hatch was the
   default path.**
4. **One value at a time hides the rhythm.** Changing `gap-0.5` to `gap-1.5` without
   simultaneously looking at the 32px header offset (`pt-8`) and the 16px card gap on the
   content side means the three spacings were never compared. Rhythm is a property of the
   *set* of spacings; you cannot tune it by editing members one at a time.

### 1.3 The process change that prevents it

**Establish the layout contract and the spacing rhythm BEFORE building, then build
scaffolds, not divs.** Concretely, in this order:

1. **Write the rhythm table first** (Section 3.1). Assign a token step to every structural
   role — page gutter, section gap, card padding, control padding, icon-label gap — *as a
   decision, before any JSX*. This is the artifact that "cramped" gets resolved against:
   the answer to feedback becomes "the contract says nav rows are `py="3"` (12px); is the
   contract wrong, or is something else cramped?" — never "let me try 10px."
2. **Build page scaffolds, not ad-hoc divs.** A route should never open a raw
   `<div className="px-6 py-10">`. It composes `PageHeader`, `Section`, `Panel`,
   `StatCard` — composites whose spacing is fixed by the contract. If the only way to put a
   gutter on a page is `<PageHeader>`, nobody can hand-code `px-6`.
3. **Lint geometry out of routes.** The system already claims a `no-route-geometry`
   ESLint rule (referenced in `layout.tsx:288` and `cockpit.tsx:7`). It is **not enforced
   on `src/app/`** and the route pages still carry geometry (`Overview.tsx:22`
   `className="mt-10"`, `Account.tsx:8` the whole `Row`). Extend the rule and the loop has
   no surface to write magic numbers on.
4. **React to feedback by editing the scale or the contract, never the leaf.** "Cramped"
   is a global instruction. The fix is one of: (a) bump the *role's* token step in the
   composite (one edit, propagates everywhere), or (b) decide the scale itself needs a
   step. Both are systematic. Editing a leaf `className` is now a lint failure, not an
   option.

The difference is not "use primitives." It is **decide geometry once, centrally, up
front, and make the central decision the only reachable one.**

### 1.4 Regressions shipped *during* the "systematic" rewrite

The rewrite was supposed to be a pure refactor ("Same behaviour"). It was not.

- **R1 — brand face fell back to Geist Sans (P0).** The rebuilt sidebar wordmark
  (`AppShell.tsx:138–144`) still hand-applies `font-display`. But `cockpit.tsx`'s page
  titles go through `<Text size="display-md">` — and `Text` (`visual.tsx:30–44`) applies
  `font-display`/mono **only when `mono` is set**, never for `display-*` sizes. The
  `display-*` tokens carry display-tuned negative tracking
  (`tokens.ts:48–53`) but inherit body `--font-sans`. **Verified live**: the computed
  `font-family` of every cockpit `<h1>` and every stat value is `"Geist Variable"` (sans),
  not Geist Mono. The brand's display face never renders on a cockpit page. This is a
  silent typographic regression hiding inside the type system, not the sidebar.
- **R2 — split-brand / lonely status (P1).** Original #23 sidebar (`8f6a3f9`) carried the
  brand **with** a live pulse dot beside "Catalyst Cockpit." Two things then happened
  independently: #25 stripped the brand block from the embedded map but **kept** the
  floating `LIVE / 4.12M ENTITIES TRACKED` (`TerminalChrome.tsx:41–49`); the rebuild
  `2f1af7c` dropped the pulse dot from the sidebar wordmark
  (`AppShell.tsx:135–149` — `BrandMark` + Stack, no pulse). Net result, **verified live**:
  the sidebar now shows a brand with no status, and the map shows a status with no brand,
  marooned in the top-right with a large empty top-left quadrant where the wordmark used
  to anchor it. The brand↔status unit was severed and neither half was made whole.

A real refactor proves behavioral equivalence. This one changed the rendered face and the
brand composition and called itself "Same behaviour" in the commit body.

---

## 2. SYSTEM GAPS — what is missing that *forced* hand-coding

The primitives (`Stack`/`Inline`/`Grid`/`Box`/`Page`/`Text`/`Card`/`Badge`/`Button`) are a
good geometry/visual split. But they are **atoms**. There is no composite layer, so every
page re-derives structure from atoms, and structure is exactly where the magic numbers
live. Each gap below names the missing pattern and a concrete API.

### G1 — No app-shell / page-scaffold composites (the biggest gap)
`AppShell.tsx` hand-builds the grid, the sticky aside, the mobile drawer, the collapse
state. `cockpit.tsx` hand-builds the page frame (`px-6 py-10 md:px-10`, `mx-auto`,
`max-w-*`, header `mb-8`). Two files, two private re-implementations of "the page,"
neither reusable, both carrying raw geometry. **Fill with:** `AppFrame`, `Sidebar`,
`PageHeader`, `Section`, `Panel` (Section 3.2). These own the gutter/section/header
rhythm so no route or shell touches it.

### G2 — `Page` exists but the cockpit doesn't use it, and it can't express the cockpit gutter
`layout.tsx:289` `Page` owns width + vertical padding. But `cockpit.tsx:35` hand-rolls
`px-6 py-10 md:px-10` instead of using it — because `Page` has **no horizontal gutter
prop** (only `py`) and **no responsive padding**. So the one primitive built to stop
route geometry was bypassed on day one. **Fill:** give the page-scaffold a `gutter`
token prop and responsive padding, or fold `Page` into `PageHeader`/`Section` (3.2).

### G3 — `Box`'s `bg` can't express accent surfaces, so accent panels are raw className
`Box` `bg` only takes `SurfaceProp` = `surface.*` (`utils.ts:76–84`). There is no way to
say "accent-soft surface with accent border." So every accent affordance is hand-coded:
the brand square (`AppShell.tsx:53`), the active nav background
(`AppShell.tsx:79`), the empty-state icon chip (`cockpit.tsx:100`), the sign-in `LIVE`
dot. **Fill:** a `Surface`/`Frame` primitive (or extend `Box`) with a `tone` prop:
`tone="accent" | "raised" | "sunken" | "default"` that sets bg **and** border as a matched
pair, plus a `Tile` for the recurring `size-8 bordered square` (brand mark, avatar chip,
empty-state icon).

### G4 — `Text` has no display/heading affordance; the type scale has a hole
Two compounding problems:
- **No heading face.** `Text` applies the mono face only via `mono` (`visual.tsx:38`).
  There is no `display` boolean, so a heading at `display-md` renders in Geist Sans (R1).
  Every place that wants the actual brand display face hand-writes `font-display`
  (`AppShell.tsx:142`, `SignIn.tsx:53`, `Proposal.tsx:322`). **Fill:** `Text` gains a
  `face?: "sans" | "mono" | "display"` prop (or a `Heading` composite) that maps
  `display-*` sizes to `--font-display` automatically.
- **The label scale is too coarse.** Real labels in the wild are `0.5625rem` (9px,
  `Proposal.tsx:26`), `0.625rem` (10px, `SignIn.tsx:53`), `0.6875rem` (11px,
  `Proposal.tsx:303`). The mono token floor is `mono-xs` = 12px (`tokens.ts:55`). So every
  sub-12px eyebrow is an arbitrary `text-[…]`. Either the 12px a11y floor is real (then
  these hand-coded 9–11px labels are an a11y bug to fix) or it isn't (then add
  `mono-2xs`). **Decide and close the hole** — right now the gap silently authorizes
  arbitrary type.

### G5 — No documented spacing-rhythm guidance
Nothing anywhere says which token step is a gutter vs. a stack gap vs. an inline gap vs.
control padding. `Stack`/`Inline` even **default `gap="4"`** (`layout.tsx:63,108`) —
a silent 16px that becomes the unexamined default everywhere. The absence of a written
rhythm is what makes "cramped" unanswerable except by nudging. Section 3.1 is this
document's fix.

### G6 — `unsafe_className` is the default, not the last resort
The primitives advertise `unsafe_className` as "last resort" (`layout.tsx:31`). In the
*rebuilt* sidebar it appears **9 times** (`AppShell.tsx:127,135,170,182,188,206,…`),
carrying real layout: `min-h-16`, `flex-1 overflow-y-auto pt-8 pb-4`, `shrink-0`, the
borders. The "systematic" file still hand-codes structure; it just routed it through an
escape hatch with "unsafe" in the name. **Fill:** promote the recurring escapes to real
props — `Stack`/`Box` need `flex1?`, `shrink0?`, `overflow?`, `minH?` (token) and a
`borderSide?: "t" | "b" | "l" | "r"` so band borders stop being className. Then lint
`unsafe_className` to zero in `src/app/`.

### G7 — No `NavItem`, no `StatCard`, no `DataRow` in a shared place
`NavRow` (`AppShell.tsx:59`), `StatCard` (`cockpit.tsx:56`), `Row` (`Account.tsx:6`),
`TermRow` (`Proposal.tsx:300`) are four hand-rolled list/row patterns that should be one
or two composites. `Row` and `TermRow` are nearly identical (label left, value right,
border-b, `py-3`) and each re-hand-codes the border and padding. **Fill:** `NavItem`,
`StatCard`, `DataRow` composites (3.2). One definition, one rhythm.

---

## 3. THE STANDARD — hard rules for structural layouts

These are binding for `apps/platform-app`. No arbitrary spacing utilities, no off-scale
values, all type through `Text`/type-tokens.

### 3.1 Spacing rhythm — token step assigned to each structural role

This is the contract. Memorize it; it is the answer to "how much space here?"

| Role | Token step | px | Rationale |
|---|---|---|---|
| **Page gutter** (content ↔ chrome edge) | `6` mobile → `10` desktop | 24 → 40 | Matches the terminal header gutter (`px-6 sm:px-10`, `TerminalChrome.tsx:23`). One gutter across map + pages. |
| **Section gap** (header ↔ body, panel ↔ panel) | `8` | 32 | The major vertical beat. Replaces today's mix of `mb-8`/`mt-10`. |
| **Card / Panel padding** | `5` | 20 | Already the de-facto card pad (`cockpit.tsx:68` `p-5`); ratify it. |
| **Card grid gap** | `4` | 16 | One step tighter than card padding — cards read as a set, not isolated. |
| **Stat label ↔ value gap** | `4` | 16 | Replaces `mt-5` (`cockpit.tsx:75`). |
| **Control padding** (nav row, button-ish) vertical | `3` | 12 | Replaces the `py-2.5`/`py-2` flip-flop. The rung "cramped" was reaching for. |
| **Control padding** horizontal | `3` | 12 | Matches `Button` `px-3` at `sm` (`visual.tsx:133`). |
| **Nav stack gap** (between rows) | `1` | 4 | Rows are one group; 4px separates without floating them apart. (`gap-1.5`→`gap="1"`.) |
| **Icon ↔ label gap** | `2` | 8 | One value everywhere an icon precedes text. (`gap-3`=12 today is too wide for a 16px icon.) |
| **Inline metadata gap** (eyebrow dot ↔ text) | `1`–`2` | 4–8 | — |
| **Sidebar band header offset** | `0` | 0 | Bands self-space via their own padding; **delete `pt-8`** (`AppShell.tsx:170`). A 32px ad-hoc shove is the #26 nudge fossilized. |

Rule: **if a spacing isn't in this table, it isn't a new magic number — it's a question
about whether the table is wrong.** Raise the table, not a leaf.

### 3.2 Composite patterns to introduce (real APIs)

Location decision (per operator: **no new packages now**): all composites live
**app-local** under `apps/platform-app/src/app/` and consume `@rare-structure-hq/ui`
primitives. `cockpit.tsx` is the seed file; split into `app/layout/`. Each composite's
spacing is the contract (3.1) baked in — **none expose a raw spacing prop.** Eventual
promotion to `packages/ui` is **recommended, not required**, once a second app needs them.

```tsx
// app/layout/AppFrame.tsx — replaces the hand-built grid+aside+drawer in AppShell.tsx
interface AppFrameProps {
  sidebar: ReactNode;           // <Sidebar/>
  collapsed: boolean;
  onToggleCollapse(): void;
  children: ReactNode;          // <Outlet/>
}
// Owns: the responsive grid (16rem|4rem ↔ 1fr), sticky aside, mobile top bar + drawer,
// the grid-template transition. Zero geometry leaks to AppShell, which becomes state-only.

// app/layout/Sidebar.tsx — brand band · nav · footer, all on the rhythm
interface SidebarProps {
  brand: ReactNode;             // <Brand/> (wordmark + status, reunited — fixes R2)
  items: NavItemDef[];
  footer: ReactNode;
  collapsed: boolean;
}

// app/layout/NavItem.tsx — replaces NavRow; no className in callers
interface NavItemDef { to: string; label: string; icon: LucideIcon; }
interface NavItemProps { item: NavItemDef; collapsed: boolean; onNavigate?(): void; }
// Padding py=3 px=3, icon-gap=2, active = accent-soft tone, all fixed.

// app/layout/PageHeader.tsx — replaces cockpit.tsx <header>
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  width?: "narrow" | "default" | "wide";
}
// title renders via <Text size="display-md" face="display"> (fixes R1).
// Owns gutter + max-width + the section gap below the header.

// app/layout/Section.tsx — replaces ad-hoc <section className="mt-10">
interface SectionProps { label?: string; children: ReactNode; }   // gap = step 8

// app/layout/Panel.tsx — the surface block; replaces bare <Card className="p-5">
interface PanelProps { tone?: "default" | "raised"; padded?: boolean; children: ReactNode; }
// padded ⇒ p=5. Sharp by house style; rounded-xl reserved for the outermost card only.

// app/layout/StatCard.tsx — keep, but drop the className; pad/gap from contract
interface StatCardProps { icon: LucideIcon; label: string; value: string; hint?: string; }

// app/layout/DataRow.tsx — unifies Account.Row + Proposal.TermRow
interface DataRowProps { label: string; value: ReactNode; }   // py=3, border-b, label/value split

// app/layout/Tile.tsx — the size-8 bordered square (brand mark, avatar chip, empty-state icon)
interface TileProps { tone?: "accent" | "default"; size?: "8" | "10"; children: ReactNode; }
```

And two **primitive-level** changes in `packages/ui` (these *are* the system, so they
belong upstream — the only recommended package edits):

```tsx
// visual.tsx — Text gains a face prop; display sizes default to the display face
interface TextProps { /* … */ face?: "sans" | "mono" | "display"; }
// size starts-with "display-" ⇒ default face "display" (Geist Mono). Fixes R1 at the root.

// layout.tsx — Stack/Inline/Box gain the escapes that are currently unsafe_className
interface BoxProps { /* … */ flex1?: boolean; shrink0?: boolean; minH?: SpacingProp;
                     borderSide?: "t" | "b" | "l" | "r"; }
// Kills the 9 unsafe_className uses in AppShell.tsx.
```

### 3.3 Definition of Done — every structural-layout PR must pass

A layout PR is **not done** until all of the following are true. This is a checklist, not
a guideline:

- [ ] **Zero arbitrary `*-[…]` spacing utilities** in changed files (no `pt-[…]`, `gap-[…]`,
      `mt-[…]`, `min-h-[…]`, `pl-[2.375rem]`, etc.).
- [ ] **Zero off-scale spacing.** Every spacing value is a token step
      {0,1,2,3,4,5,6,8,10,12,16,20,24}. No `1.5`, no `2.5`, no `0.5`.
- [ ] **Zero raw geometry in routes** (`src/routes/**`) — no `max-w-*`, `mx-auto`, `px-*`,
      `py-*`, `mt-*`. Routes describe content; composites frame it. `no-route-geometry`
      must be extended to cover this and pass.
- [ ] **`unsafe_className` count is 0** in `src/app/**` (escapes promoted to props).
- [ ] **All type via `Text` + type tokens.** No `text-[…rem]`, no `tracking-[…]`. Headings
      use `face="display"`; eyebrows use a mono token (add `mono-2xs` if sub-12px is
      sanctioned, else raise to `mono-xs`).
- [ ] **All color via token props / CSS vars.** No raw hex. (Already largely true; keep it.)
- [ ] **Every structural block is a composite**, not a raw `<div>`/`<section>`/`<nav>` with
      inline className. If a new structural pattern appears twice, it becomes a composite
      before the PR lands.
- [ ] **Spacing maps to the 3.1 rhythm table.** Any deviation is justified in the PR body
      as a *table change*, reviewed as such — never an inline one-off.
- [ ] **Refactors prove equivalence.** A "refactor"/"systematic rewrite" PR includes
      before/after screenshots at 1440 and 375 showing the render is identical (this would
      have caught R1 and R2).
- [ ] **Verified rendered**, not just compiled — screenshot at desktop + mobile, sidebar
      expanded + collapsed.

---

## 4. CONCRETE FIX PUNCH-LIST — prioritized, file:line

Tags: **P0** = mechanical systematization, safe unsupervised tonight. **P1** = introduce a
composite + migrate. **P2** = taste/visual polish needing the operator's eye.
Effort tag: **[mechanical]** vs **[taste]**.

### P0 — mechanical, do tonight

- **P0 · [mechanical] `cockpit.tsx:35`** — `<div className="px-6 py-10 md:px-10">` →
  use the page-gutter rhythm (step 6→10). Replace the bespoke gutter with `<Page>` once
  it carries a `gutter` prop, or hard-map to `px-6 md:px-10 py-10` *via a composite*. No
  arbitrary values remain.
- **P0 · [mechanical] `cockpit.tsx:37`** — header `mb-8` is fine (step 8) but `gap-3`
  (12) between title/desc and `gap-2` stack should follow 3.1 (title↔desc = step 2).
  Normalize.
- **P0 · [mechanical] `cockpit.tsx:75`** — StatCard `mt-5` (20) → step `4` (16), the
  label↔value gap in 3.1. Use `Stack gap="4"`, drop `mt-5`.
- **P0 · [mechanical] `cockpit.tsx:99`** — EmptyState `gap-3 px-6 py-16` → `py-16` is
  step 16 (ok); `gap-3`→`2`; the `size-10` icon chip (`cockpit.tsx:100`) → `Tile`.
- **P0 · [mechanical] `cockpit.tsx:15–19`** — `PAGE_W` duplicates `pageMaxWidth`
  (`utils.ts:125`). Delete the local copy; import the system table. (Two sources of the
  same widths is exactly the drift the tokens package exists to prevent.)
- **P0 · [mechanical] `Overview.tsx:22`** — `<section className="mt-10">` → `Section`
  composite (step 8 gap). Removes route geometry.
- **P0 · [mechanical] `Account.tsx:8`** — `Row` hand-codes `gap-4 border-b … py-3`. Move
  to `DataRow` (3.2). Same for **`Proposal.tsx:300`** `TermRow` (`pt-3 pb-3`) — collapse
  both into one `DataRow`.
- **P0 · [mechanical] `Account.tsx:28`** — `<div className="mt-3">` and the two
  `className="mt-3"` (`Account.tsx:38`) → `Stack gap` per rhythm.
- **P0 · [mechanical] `AppShell.tsx:170`** — `unsafe_className="flex-1 overflow-y-auto
  pt-8 pb-4"`: **delete `pt-8`** (the fossilized #26 nudge), and `pb-4`/`flex-1`/
  `overflow` become props (`flex1`, `overflow`, `py` from contract). The nav band should
  self-space, not be shoved 32px.
- **P0 · [mechanical] `AppShell.tsx:76,80`** — NavRow `gap-3` (icon↔label) → step `2`
  (8); `px-3 py-3` is step 3 (ok, keep). `gap-1.5` is already gone from this file (good)
  — but `Stack gap="2"` (`AppShell.tsx:167`) for nav rows should be `gap="1"` per 3.1.
- **P0 · [mechanical] `AppShell.tsx:142,284` & `SignIn.tsx:53,65,83` &
  `Proposal.tsx:26,…`** — every `tracking-[0.16em]`/`[0.18em]`/`[0.2em]`/`[0.12em]` is a
  hand-coded letter-spacing that **duplicates** the tracking already baked into the mono
  tokens (`tokens.ts:55–57`). Use `Text mono size="mono-xs|sm"` and delete the manual
  `tracking-[…]`. (Mono tokens: `mono-xs` 0.18em, `mono-sm` 0.1em, `mono-md` 0.05em.)
- **P0 · [mechanical] `SignIn.tsx`** — replace the four `text-[0.625rem]`/`[0.6875rem]`
  and `tracking-[…]` label/notice strings (`SignIn.tsx:53,56,65,83,100,105,122,131`) with
  `Text` + mono tokens. The inputs' `py-2.5` (`SignIn.tsx:77,95`) is **off-scale** → step
  `3` (12) or `2` (8). The card width `max-w-[22rem]` → a `pageWidth` token.
- **P0 · [mechanical] `App.tsx:39` & `Proposal.tsx:727,739,742,745` & many** — the
  `text-[0.625rem] … tracking-[0.2em]` "Authorizing…"/loading strings → `Text` mono
  tokens.

### P1 — introduce a composite + migrate

- **P1 · [mechanical] R1 fix — `visual.tsx:30–44`** — add `face` to `Text`; default
  `display-*` sizes to `--font-display`. Then **every cockpit `<h1>`/stat value renders in
  Geist Mono** as the brand intends, with no per-call `font-display`. This is the
  highest-leverage single change in the app: one prop, fixes the entire heading face.
- **P1 · [mechanical] `AppShell.tsx` whole file** — introduce `AppFrame` + `Sidebar` +
  `NavItem` (3.2); reduce `AppShell` to state (collapse/mobile) + composition. Eliminates
  all 9 `unsafe_className` and `SQUARE`/`DIVIDER` constants (`AppShell.tsx:47–49`) — those
  become `Tile` and `borderSide` props.
- **P1 · [mechanical] `cockpit.tsx`** — split into `app/layout/{PageHeader,Section,Panel,
  StatCard,DataRow,EmptyState,Tile}.tsx`. `CockpitPage`→`PageHeader`+`Section`.
- **P1 · [taste] R2 fix — `AppShell.tsx:135–149` + `TerminalChrome.tsx:41–49`** — reunite
  brand + status. Either (a) restore the live pulse dot to the sidebar wordmark and let
  the embedded map drop *both* brand and status (the sidebar owns the "LIVE" identity), or
  (b) keep the map's status but give it an anchor. Needs the operator's eye on which
  surface owns "LIVE." Default recommendation: sidebar owns brand+LIVE; embedded map shows
  neither (the empty top-left then needs filling — see P2).
- **P1 · [mechanical] `Box`/`Surface` accent tone — `utils.ts:78`, `layout.tsx:219`** —
  add `tone="accent"` (bg `accent-soft` + border `accent`) so the four hand-coded accent
  surfaces (`AppShell.tsx:53,79`, `cockpit.tsx:100`) stop being raw className.

### P2 — taste/visual, operator's eye

- **P2 · [taste] Map embedded top-left void** (`MapView.tsx:78`, `TerminalChrome.tsx`) —
  with the brand stripped, the top-left quadrant is dead. Fill with a thin context strip
  (active query / "no query — ⌘K to begin" / last-sync) so the header band is balanced,
  not a lonely right-aligned `LIVE`.
- **P2 · [taste] Stat-card placeholder city** (`Overview.tsx:15–19`) — five of six cards
  render a bare `—`. Decide a real empty treatment (dim "—" with a `mono-2xs` "no data"
  caption, or hide-until-data) so the dashboard doesn't read as broken.
- **P2 · [taste] Account two-panel imbalance** (`Account.tsx:23–43`) — Billing is 2 lines
  in an equal-height card → vast dead space. Either let cards size to content
  (`items-start` on the grid) or give Billing real content (a "Contact desk" action,
  invoice stub).
- **P2 · [taste] Empty-state vertical void** (`cockpit.tsx:99` `py-16` inside a full-width
  `Card`) — the Recent-Activity card is enormous for one centered line. Cap the empty
  card height or move the empty state inline.
- **P2 · [taste] SignIn marooned island** (`SignIn.tsx:50`) — a 340px form dead-center in
  a black void, no chrome, no scanlines, no framing. For an "intelligence terminal" the
  sign-in reads generic. Add the scanline texture / a framed panel / the wordmark lockup
  with the LIVE dot so the gate feels like the same instrument.
- **P2 · [taste] Collapsed active-tab affordance** (`AppShell.tsx:79`) — in the rail the
  active tab is a soft full-bleed accent-soft wash; consider a 2px left accent bar for a
  sharper "you are here" that fits the sharp-edge house style.

---

## 5. VISUAL VERDICT

Blunt: **the sidebar is genuinely good; the content surfaces look unfinished and slightly
broken, and one brand-defining detail (the heading face) is silently wrong everywhere.**
Not shit — the bones and the palette are strong — but it does not yet read as the polished
institutional terminal the brand promises. Defects, with the fix:

**The map cockpit (`/app/map`)** — the strongest screen. The cartographic base, graticule,
scatter field, scanlines, and accent glow are excellent and on-brand. Defects:
- *Empty top-left quadrant.* Stripping the brand (#25) left the header band with content
  only on the right; the `LIVE / 4.12M ENTITIES TRACKED` floats unanchored. **Fix:** P2
  context strip (4.P2.1).
- *Map hugs the sidebar divider.* The map pane's `px-6` (`MapView.tsx:80`) gives a thin
  left gutter against the 1px divider; it reads slightly cramped against chrome. **Fix:**
  align to the page-gutter rhythm.

**Overview (`/app/overview`)** —
- *Heading face wrong.* "Overview" is soft Geist **Sans**, not Geist Mono — verified. In a
  mono-uppercase terminal this title looks like it wandered in from a different product.
  **Fix:** R1 (4.P1.1). Single highest-impact visual fix in the app.
- *Broken-dashboard read.* Five of six stat cards show `—`. **Fix:** 4.P2.2.
- *Vertical rhythm drift.* Header `mb-8` (32) then section `mt-10` (40) then card gap 16,
  card pad 20 — four unrelated beats. **Fix:** the 3.1 table (32 section / 20 pad / 16
  grid).
- *Recent-Activity card is a cavern* for one centered line. **Fix:** 4.P2.4.

**Account (`/app/account`)** —
- *Two-panel imbalance.* Profile is dense; Billing is two lines + an equal-height void.
  **Fix:** 4.P2.3.
- *Face clash inside one card.* "Profile"/"Billing" headings are Geist Sans semibold
  (`Account.tsx:25`) while the `EMAIL/ORGANIZATION/ROLE` row labels are mono-uppercase —
  two faces fighting inside one 20px-padded card. **Fix:** R1 + consistent label tokens.
- *Lower 60% of the viewport is dead.* The two cards float at top with nothing below.

**Collapsed sidebar** — *good.* 64px rail, brand mark, 5 icon tabs, OP chip + sign-out,
content reflows wider correctly. Active tab is a soft wash (minor; 4.P2.6).

**Sign-in (`/signin`)** — *weakest screen.* A ~340px form island dead-center in a black
void. No texture, no frame, no wordmark lockup with the live dot. Reads generic, not
terminal. **Fix:** 4.P2.5. Also every label here is hand-coded `text-[0.625rem]` +
`tracking-[…]` and the inputs use off-scale `py-2.5` (4.P0).

**Mobile (375)** — *shell works.* Top bar (brand + hamburger), 1-col stat stack, drawer
nav. Defects: the `display-md` title is oversized and (again) Geist Sans; the six tall
mostly-empty cards make for a long scroll of `—`. **Fix:** R1 + 4.P2.2; consider a denser
2-up stat grid on mobile or a smaller title step.

**Genuinely good (credit where due):** the geometry/visual primitive split is the right
architecture; the token palette and contrast discipline are excellent; the collapsible
rail with persistence is clean and the collapsed state is well-considered; the map surface
is a strong, coherent instrument; the rebuilt sidebar's *spacing* is now on-scale and reads
well. The skeleton is sound. The problem is everything hanging off it was hand-coded, and
the brand face never made it onto the headings.

---

# EXECUTIVE SUMMARY — top 5 actions, in execution order for tonight

1. **R1 · Add `face` to `Text`, default `display-*` to Geist Mono** (`visual.tsx:30–44`).
   **P1 · [mechanical].** One prop; fixes every cockpit heading and stat value rendering
   in the wrong (sans) face across Overview/Account/mobile. Highest leverage, lowest risk.
2. **Sweep off-scale + arbitrary spacing/type to tokens** across `cockpit.tsx`,
   `Account.tsx`, `SignIn.tsx`, `App.tsx`, `Overview.tsx`, `AppShell.tsx:170` (kill
   `pt-8`), and the `tracking-[…]`/`text-[…rem]` duplication everywhere. **P0 ·
   [mechanical].** This is the systematization the operator asked for; the 3.1 rhythm
   table is the spec.
3. **Introduce the page-scaffold composites** — `PageHeader`, `Section`, `Panel`,
   `StatCard`, `DataRow`, `Tile` under `app/layout/` (split `cockpit.tsx`), and migrate
   the routes onto them. **P1 · [mechanical].** Removes route geometry and unifies
   `Row`/`TermRow`. Recommend (don't require) later promotion to `packages/ui`.
4. **Rebuild `AppShell` on `AppFrame`/`Sidebar`/`NavItem`** to drive the 9
   `unsafe_className` and the `SQUARE`/`DIVIDER` constants to zero (`AppShell.tsx`). **P1 ·
   [mechanical].** Finishes the job the rebuild started — the "systematic" file is still
   hand-coding structure through the escape hatch.
5. **R2 + the visual voids** — reunite brand+`LIVE`, fill the map's empty top-left, fix the
   stat-card `—` placeholder, balance the Account panels, and frame the sign-in. **P2 ·
   [taste].** Needs the operator's eye on which surface owns the "LIVE" identity and on the
   empty-state treatment; do after 1–4 land.
