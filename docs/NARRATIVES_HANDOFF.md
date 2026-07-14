# Narrative Thesis Work — Agent Handoff

**Scope:** the capital-provider narrative gallery in `rare-structure-hq` (platform-app) and its
query substrate in `core-x`. State as of 2026-07-14 (`rare-structure-hq/main @ 80c91f6`).

**The one sentence that explains everything:** narratives are data in
`apps/platform-app/src/demo/narratives/index.ts`, cards are parametrized React components fed by
baked `apps/platform-app/src/demo/*.json` snapshots, and the snapshots are regenerated from the
core-x query-sidecar (and a few Lance-only datasets).

---

## 1 · What this is

A guided-tour presentation surface for pitching **capital providers** (factoring / AR / ABL /
equipment-finance / working-capital lenders) on federal-market theses. The operator opens a
narrative on a call and clicks through "beats" (cards); every number on screen traces to a pinned
query snapshot or a live deterministic phrase query.

- Gallery: `http://localhost:5173/app/demo` (also reachable via Settings → Narratives card)
- Tour: `/app/demo/:narrativeId`
- Contract: every beat discloses its recipe (phrase or snapshot source) in the rail, and its
  artifact stamp on the card. Zero LLM at query time. No hardcoded numbers presented as live.

## 2 · The six narratives (ranked by sharpness)

| id | Title | Audience / thesis | Status |
|---|---|---|---|
| `medical-staffing` | The Exam Backlog | **Sharpest.** PACT Act → 6.3M veterans on comp (+28% since FY19) → county-level demand×supply gap (worst in military towns: Bell/Ft Cavazos 25:1, Onslow, Comal) → SAM candidate bench (37K active med/staffing firms). Proprietary moat: provider_360 × VA-demand join nobody else has. | 3 beats, live |
| `facilities-cleaning` | The Facilities Floor | **#2.** ~$20B/yr S-code annuity (guard $5.7B > grounds > facility-ops > janitorial), 7,240 winners, deep mid-market, avg deal ~$368K. Structural driver: $60.2B civilian deferred-repair backlog, median building 1983. Kicker: DoD half (+29% FY24→25) frozen by FY26 shutdown/CR, funded ($838.7B enacted 2026-02-03) and queued to release. | 4+ beats, live |
| `equipment-yard-79925` | The Border Yard | Original narrative (border equipment yard, zip 79925). OBBBA $46.5B barrier thesis → obligation wave → money map → dirt-iron combos → territory → primes/sub-out projection. Operator has since deprioritized yards in favor of capital providers, but the Act-1 macro cards are shared. | 9 beats, live |
| `equipment-finance` | The Iron Wave | Capital-provider clone of the yard macro spine. Key honest reframe: the $56B mega tier (77%) is a "targeting mirage"; the servable market is ~2,500 mid-market pure-play heavy-civil primes holding $15.7B, ~59% already carrying blanket/AR UCC liens (CA data). | draft, 4 beats |
| `manufacturing-coil` | The Procurement Coil | DoD is the one buyer ($107B); −13% run-rate is timing not demand (appropriated, not obligating). Release = working-capital event. Aerospace sub-tier is *named* (9.4B/yr subawards, Tier-2s like Natel, AeroCision). | draft, 3 beats |
| `profservices-coil` | The Labor Coil | NAICS 54: DoD −39% vs civilian −4% → one buyer's freeze, not demand loss. Payroll-in-arrears book, 45–60d float, receivable backed by enacted budget. Lowest-risk AR lane. | draft, 3 beats |

**On-call cuts (deliberately NOT narratives):** FL federal tax liens × SAM contractors (~208
high-confidence matches, construction-led — a killer slide inside a distressed-AR pitch);
wildfire/forestry 1153 ($1.56B, mid-market owns 61%, megas 3% — best structure, small $);
freight factoring (rejected: federal freight is $0.8B and mega-locked).

**Deal-economics framing (for seat-fee conversations):** a facilities firm's fundable AR ≈ 13% of
annual federal revenue (1.75mo float × 90% advance). A $10M-book borrower ≈ $1.3M funded ≈
$150–290K/yr lender revenue ≈ ~$1M over a 5-yr contract life. One sourced borrower repays a
~$100K/yr capacity seat several times over.

## 3 · Key files — rare-structure-hq (`apps/platform-app/src/`)

**Architecture (read in this order):**
- `demo/narratives/index.ts` — **the registry.** `Narrative` + `Beat` types and all six
  narratives. A new narrative = new object here. A new card type = new `BeatKind` here + a render
  branch in DemoTour.
- `routes/app/DemoTour.tsx` — tour engine. Reads `:narrativeId`, renders rail + stage, holds the
  kind→component switch and all per-narrative card props (thesis copy lives here for the coil
  narratives).
- `routes/app/DemoGallery.tsx` — the gallery at `/app/demo`.
- `App.tsx` — routes (`demo`, `demo/:narrativeId`); `routes/app/Settings.tsx` — entry HubCard.

**Card components (`demo/`):** `ThesisView` (stat-triple + statement; parametrized),
`WaveView` (monthly bars + event pins; parametrized, tick-thinning for long series),
`MoneyMapView` (US map, $-sized state dots, click-to-reveal detail; parametrized),
`FreezeView` (DoD-vs-civilian paired bars + reporting-lag shading; parametrized),
`CombosView` (NAICS×PSC table w/ work_summary + equipment lists; parametrized),
`PrimesView` (primes → historical sub-out rate → projected flow, expandable partners),
`TerritoryView` (state frame + radius ring + military bases), `BandsView` (size-band
distribution), `PactGapView` (county demand÷clinician-supply map), `PactSupplyView`
(candidate-bench county map).

**Shared plumbing:** `demo/aggregatePhrase.ts` (live phrase-broker client → BFF
`/api/v1/federal/phrase`), `demo/projection.ts` + `demo/us-geo.ts` (Albers projection + committed
state outlines — reuse for any map card), `demo/types.ts`.

**Baked snapshots (`demo/*.json`):** `wave-obbba`, `money-map-obbba`, `flow-national-obbba`,
`combos-79925-100`, `primes-79925-100`, `money-map-scode`, `bands-scode`, `freeze-scode`,
`coil-manufacturing`, `coil-profservices`, `map-manufacturing`, `map-profservices`, `pact-wave`,
`pact-gap`, `pact-supply`. Each carries its source scope + artifact stamp inside the JSON.

⚠️ **Snapshot staleness:** most are pinned to sidecar artifact `20260712T021021Z`; the sidecar has
since rebuilt (≥ `20260712T224718Z`, 85 tables — the VA tables promotion). Cards render fine on
baked data; refreshing = re-running the bake queries below and overwriting the JSON. The bake
scripts were run ad-hoc (not committed); §5 has everything needed to reproduce them.

## 4 · Key files — core-x

- `docs/reference/QUERY_SIDECAR_AGENT_GUIDE.md` — **read first.** The warm-DuckDB sidecar: table
  map, query doctrine. Analytical questions go here before any Lance scan.
- `docs/reference/PHRASE_QUERY_STACK_ONBOARDING.md` — the phrase stack (catalyst-api on Railway,
  **auto-deploys from core-x main**; kill switches; executor).
- `apps/catalyst_api/src/phrase_aggregate.py` — **phrase-agg.v2** closed grammar. Two productions:
  `total <measure> <group> <window>` (portrait) and
  `total active awards near <zip5> within <N> miles by equipment` (yard). Pinned tests:
  `apps/catalyst_api/tests/test_phrase_aggregate.py`. New live-query card types = new productions
  here (merge to main → auto-deploy).
- `demos/equipment_yard/queries.py` — the named-query registry / snapshot-runner pattern
  (zip→centroid→bbox+haversine, `require_artifact` pinning) that all baked cards follow.

## 5 · Querying the substrate (how to re-bake or extend)

**Sidecar (primary):** `POST https://query-sidecar-api.onrender.com/api/v1/sql` with
`{"sql": ..., "limit": N}`, bearer `QUERY_SIDECAR_TOKEN`. Health: `/healthz` (returns current
artifact). Run everything under `doppler run -p core-x -c prd --`. Notes: DuckDB dialect;
some keywords blocked (e.g. a bare `else`-less CASE label like "maintain" tripped once — rename
labels if you hit "blocked keyword"); `DESCRIBE <table>`, `SHOW TABLES` work; timestamp cols can
trip pytz in results — select around them.

**Key sidecar tables:** `gtm_txn_events_slim` (transaction ledger: action_date,
action_type_code, naics, psc, agency, obligation — no geo), `txn_events_combo_by_geo` (adds
pop_state/county fips), `gtm_open_awards` (active awards w/ lat-lon PoP, subaward_count),
`naics_psc_equipment_needs` (curated equipment-combo verdicts + buckets + comma-list needs),
`naics_psc_deliverable` (what_was_done), `subaward_canonical_slim` (prime→sub edges w/ names,
FSRS under-reports construction, ~9× denser for aerospace), `award_descriptions`,
`federal_sites_lance` (military bases: site_source='military_base'), `sam_ucc_filings`/
`sam_ucc_lenders` (**CA+CO only** — use CA as the double-click lens),
`va_disability_comp_county` (FY19–25 recipients + SCD severity + age by county fips),
`va_vetpop_county_total` (projections to 2053), `gtm_sam_entities` (SAM registry w/
physical_state/zip, declared naics/psc lists, domains).

**Lance-only (read via `lance.dataset('s3://data-sink/active/<name>/', storage_options=R2 creds)`
under doppler; use `uv run` in core-x):** `provider_360/snapshot=2026-06/` (9.55M NPIs, Medicare
enrichment, practice zip), `naics_psc_labor_dim` (work_summary ≤20 words + naics/psc titles —
**not on the sidecar**, a known gap), `frpp_civilian_real_property` (building age /
condition_index / repair_needs — $-string columns, cast with regexp_replace; 'Building' type,
fiscalyear='2024'), `census_zcta_county_rel_2020` (zip→county), `census_county_gazetteer_2023`
(county lat/lon), `fl_federal_tax_liens` (22.5K IRS liens).

**DoD data caveats (recur constantly):** agency code `097` = DoD; DoD FPDS actions publish on a
~90-day delay so trailing months are structurally dark (never present them as zeros); the FY26
shutdown (Oct–mid-Nov 2025) + CR + late approps (NDAA 2025-12-18, DoD approps $838.7B
2026-02-03) is the "coil" behind every DoD-suppression chart.

## 6 · Running locally

- BFF: `cd apps/platform-api && doppler run -- bun --watch src/index.ts` (→ :8000; doppler
  project `hq-rare-structure-hq/prd`).
- App: `cd apps/platform-app && doppler run -- sh -c 'VITE_API_BASE_URL=http://localhost:8000
  ./node_modules/.bin/vite --host 0.0.0.0 --port 5173'` — the inline override must be INSIDE the
  doppler wrapper or doppler's prod URL wins. Vite needs doppler for `VITE_HQX_SUPABASE_*` or
  auth breaks with "Load failed".
- Typecheck: `cd apps/platform-app && ./node_modules/.bin/tsc -b --noEmit`.
- **Auth gate — read before "verifying" the gallery:** every `/app/*` route (gallery included) is
  wrapped in `RequireOperator` (client-side route guard in `App.tsx`) and will bounce an
  unauthenticated browser context to `/signin` no matter what the code does. This is not a bug to
  debug. To get a session in dev: open `http://localhost:5173/signin` and click **"Preview:
  operator"** (dev-only affordance in `routes/app/../SignIn.tsx` — drops a mock operator session
  via `devSignIn`; no credentials needed; only rendered when `import.meta.env.DEV`). Real sign-in
  needs the Supabase env vars, which is another reason vite must run under doppler. Note the BFF's
  `/api/v1/federal/*` endpoints are public — data answering while the page gates is expected, not
  a mixed signal.

## 7 · Open threads (natural next work)

1. **Refresh baked snapshots** against the current sidecar artifact (mechanical re-bake).
2. **Facilities deck build-out:** S-code composition card (guard > grounds > ops > janitorial)
   and the building-age/deferred-maintenance decay chart ($60.2B backlog, era table) — data
   pulled and validated, cards not yet built.
3. **Candidate-net widening (medical):** let firms "inherit" health codes from won/subbed award
   combos, not just SAM-declared; LLM-confirm top candidates via `normalized_domain` (19K have
   domains); size-validate via `crosswalk_dsbs_sam` / `icypeas_dsbs_company_profiles`.
4. **UCC incumbent-lender roster** for CA construction (parse `secured_parties`; the
   competitive-displacement map for lender pitches).
5. **Aerospace Tier-2 roster** (mid-market subs under 336 primes) for the manufacturing coil.
6. **Sidecar gap to log:** `work_summary` column missing from `naics_psc_labor_profile` mart
   (must come from Lance `naics_psc_labor_dim`).

## 8 · Ground rules observed in this work

- Every card claim must be reproducible from a disclosed query; refusals/limits are disclosed on
  the card (e.g. FSRS under-reporting, DoD lag, "civilian = non-DoD FRPP").
- Prefer run-rate ($/mo) comparisons across unequal windows; pin `require_artifact` when a deck
  must be internally consistent.
- Iterate locally (HMR) without committing per-card; batch-commit at operator checkpoints.
  Merged PRs so far: rare-structure-hq #266–#270; core-x #1136–#1139 (phrase-agg.v1/v2).

---

## 9 · Addendum — 2026-07-14 session (Facilities Floor rebuild, PR #273)

State as of `main @ 4a96277`. The 2026-07-14 session rebuilt **The Facilities Floor**
(`facilities-cleaning`) as a voiceover-first pitch video (~90s target) and added a seventh draft
narrative **The Other Wave** (`capital-arc`, capital providers). §2's table is superseded for
these two narratives; everything else in this doc still holds.

**The Facilities Floor arc as built:** blank-ish thesis → $2.26T all-sector pie → $36B facility-
services pie → 12 named live awards on the map → metronome year cards (2021–2025, fixed shared
y-scale, 2025 stops at Sep with empty Oct–Dec slots) → red-October card (↓70%) → shutdown statute
card → federal-estate map (blue GSA dots, then orange bases) → 49.9/50.1 DoD-split pie →
Sep-vs-Oct cliff → recovery stepper + Oct/Nov/Dec lane cards (each lane vs its own FY25 monthly
average; facilities is the only lane never reaching 100%) → **Act 3: Feb-3 catalyst card + "the
hole"** ($1.6B deficit in the four lag-clean months; $4–5B projected). Beats no longer in the
story sit under an `act: "Archive"` shelf rather than being deleted.

**The card-building loop (the pattern to copy):**
1. Probe the **query-sidecar first** (`/sidecar-query`) — surgical queries at the operator's pace;
   numbers get discussed in chat *before* any card is built. Never one-shot a deck.
2. Bake the result into `src/demo/<name>.json` with `scope` + `artifact` stamp inside the JSON.
3. Component in `src/demo/<Name>View.tsx` — parametrized (props with defaults) so later cards
   reuse it (`ConstrPieView` and `BoringYearView` are the reference examples). In-system palette:
   accent color at stepped opacities; error-red only for the knife moment.
4. Register: new `BeatKind` + beat entry in `narratives/index.ts`, render branch in `DemoTour.tsx`
   (per-beat props live in the DemoTour switch, keyed on `active.id` when one kind serves
   several beats).
5. `tsc -b --noEmit`, HMR — the operator verifies visually in their own browser; do not
   screenshot-verify.

**Conventions established this session (operator-set, follow them):**
- Voiceover leads; cards illustrate. 1–2 sentences per beat. Options/registers offered in chat
  ("cooler vs hotter"), operator picks.
- Answer the question asked, then STOP — no closing questions, no unsolicited narrative
  conclusions ("this is the bridge to your deck" = no).
- Every data response ends with a one-line access note: sidecar or Lance (so sidecar gaps
  surface).
- Sales-asset register: minimal footers (artifact stamp + scope), no methodology bibliographies;
  deeper caveats live in the operator's talk track, not on cards.
- Exact numbers over round ones on cards (49.9%, not 50%) — round numbers read as invented.
- DoD data: last lag-clean month is ~Jan 2026 (effective publish delay runs past the nominal 90
  days — Feb+ months in the current artifact are still filling). Never chart trailing DoD months
  as real zeros; `gtm_open_awards` DoD `total_obligation` is complete only through ~Jan.

**Load-bearing numbers this session pinned (artifact `20260713T043612Z`):** S-codes ≈ $19–20B/yr,
FY23–25 $49.9B / 12,341 firms; DoD:civilian 49.9/50.1 (FY25 53/47, DoD +29% FY24→25); the
metronome floor ($0.7B/mo for 57 straight months) broken by Oct-2025 $0.70B (lane total) /
$0.21B (DoD half); recovery Dec-2025 hardware 129% / engineering 112% / construction 107% /
facilities 77% of own FY25 norm; civilian March-2026 record $2.22B (the release preview); DoD
approps $838.7B enacted 2026-02-03; middle bands at the $10M/3yr split (lower 972 firms·$3.4B,
upper 407·$11.0B, anchor contracts $1.4M/$8.3M, "substantial contract" = ≥$250K); active S-code
awards 9,664 / $29.6B obligated / $177.4B ceiling ($79.9B DoD). Borrower shortlists: civilian
growers (Simmons & Golden, Vision Quest, GXC — built as portrait cards in `capital-arc`) and
DoD-coil holders (Alutiiq, Diversified Service Contracting, KGJJ — data pinned, cards unbuilt;
these are the on-thesis set for the Facilities Floor ending).

**Open threads after this session:** welcome/#0 card copy; thesis-card copy refresh (predates the
arc); estate-map named-base labels; possible FRPP aging-estate beat (median 1983, $60.2B backlog —
Lance pull); DoD borrower portraits + deal-economics closer for Facilities Floor Act 3; whether
the middle-class band card returns from the archive (raw notes' beat #8 implies yes); re-check the
DoD Feb/Mar fill-in at the next sidecar rebuild (~Sep–Oct 2026 makes post-enactment months
readable).

## 10 · Canonical scope definitions (do NOT hand-roll NAICS/PSC lists)

**Heavy-civil / "iron" scope — use the equipment-needs mart, not a NAICS list.** A NAICS-only cut
(237*/238910) under-counts ~20×: most dirt-and-iron work is filed under NAICS 2362 (building
construction) with heavy-civil PSCs (Y1PZ barrier, Y1LB roads, …). The curated source of truth is
the sidecar mart `naics_psc_equipment_needs` (per-combo verdicts: `in_scope`, `equipment_buckets`,
`primary_bucket`, `proposed_equipment_needs` machine lists, `reasoning`). Buckets:
`heavy_earthmoving_civil` (693 combos), `material_handling_cranes` (1,465), `trucks_heavy_haul`
(337), `aerial_access` (110), `industrial_power_support` (3,124).

```sql
-- IRON SCOPE (canonical): combos whose curated verdict includes heavy iron
WITH scope AS (
  SELECT DISTINCT naics_code, psc_code FROM naics_psc_equipment_needs
  WHERE in_scope
    AND len(list_filter(equipment_buckets, x -> x = 'heavy_earthmoving_civil')) > 0
)
SELECT … FROM gtm_txn_events_slim t JOIN scope USING (naics_code, psc_code) …
```

**CONSTRUCTION-IRON SCOPE (the one to use for equipment-finance narratives):** two gates —
(1) bucket union `heavy_earthmoving_civil / aerial_access / trucks_heavy_haul /
material_handling_cranes` (everything an equipment-finance shop writes paper against, dozers to
scissor lifts), AND (2) `substr(naics_code,1,2) = '23'` (construction industry). The industry gate
matters: ungated, the bucket union pulls $83.8B of NAICS-33 manufacturing (shipyard cranes,
aircraft handling — not the audience). Calibration (artifact `20260713T043612Z`), since-signing
obligations: naive 237*-only cut $2.9B / 1,006 firms → earthmoving-bucket-only $58.6B / 7,554 →
**construction-iron scope $63.4B / 5,185 firms**. Strict core variant:
`primary_bucket = 'heavy_earthmoving_civil'`. The Iron Wave cards built 2026-07-14 (iron-mirage /
iron-book / iron-dropmic) predate this definition and carry the narrow numbers — re-derive before
reusing them.
