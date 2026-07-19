# rare-structure-hq — agent substrate

Bun-workspace monorepo for the Rare Structure platform + marketing surfaces. This repo is a
CONSUMER of the core-x data plane — it treats core-x as an upstream (via its gateways), never
reaches into Lance/R2 directly, and never composes SQL against core-x.

## Workspace layout

- `apps/platform-app` — Vite + React SPA (dev port 5173).
- `apps/platform-api` — Hono BFF (dev port 8000; `PORT` env at the Railway layer).
- `apps/marketing-site`, `apps/marketing-site-ao` — marketing surfaces.
- `apps/lander` — access.governmentcontracted.com: per-prospect private-memorandum pages
  (tokenized, baked to R2 `data-sink/landers/`, no database; mint/media/views operator
  workflow in its README).
- `packages/tokens`, `packages/ui`, `packages/shared`,
  `packages/eslint-plugin-rare-structure-hq`.
- Secrets: Doppler project `hq-rare-structure-hq`.

## The two-upstream topology (LOAD-BEARING — do not blur it)

The BFF (`apps/platform-api`) talks to TWO distinct core-x gateways with distinct env seams:

1. **catalyst_api** — the quiet Gen-3 READ gateway. Env names: `COREX_API_URL` +
   `COREX_SERVICE_TOKEN` (zod-validated in `src/env.ts`) and `CATALYST_API_URL` (same
   service, raw-env seam in `routes/federal.ts` for the market/jtbd brokers). Serves:
   `award-profile`, `federal` (incl. the `/map/*` workbench query brokers), `market-spec`,
   `market-collections`.
2. **edge_api** — the high-churn automation/write plane. Env names: `EDGE_API_URL` +
   `EDGE_API_SERVICE_TOKEN` (raw-env seam, `src/lib/edge.ts`). Serves: bookings, deals,
   proposal-templates, Documenso (templates/mirror/prefill/defaults/public), settings —
   AND `routes/market.ts` (the audience builder: cohort queries + Close push). The audience
   push is INTENTIONALLY on edge — it is an action engine, not a read. Do not "fix" it onto
   catalyst.

Trust model everywhere: platform-app sends the user's Supabase access token; `requireUser`
validates it in the BFF; the BFF then calls the upstream with the INTERNAL service token —
the user's JWT is never forwarded.

## Warm federal-store invariant

`src/lib/federal-store.ts`: the federal map/chart surface answers from RAM. The precomputed
artifacts (`charts.json`, `entities.json.gz` — ~5MB, git-committed under `src/data/federal/`)
load ONCE at boot; request paths do no Lance, no DuckDB, no core-x round-trip. Refresh =
re-run the core-x precompute (`pipelines/serving/materialize_federal_charts.py --bundle-out`)
and redeploy. Never add a live core-x call to a public federal path.

## Dev loop

- `bun install` — Bun >= 1.3, Node >= 22.
- SPA: `bun run --filter platform-app dev` (5173) — `.claude/launch.json` has this wired.
- BFF: run `apps/platform-api` with Doppler env (`hq-rare-structure-hq`), port 8000.
- The `/local-stack` skill brings up both with working Supabase auth.

## CI and lint laws

- CI (`.github/workflows/ci.yml`): typecheck → build → lint → Playwright e2e. All four must
  pass; run `bun run typecheck && bun run build && bun run lint` before pushing.
- **no-route-geometry**: `rare-structure-hq/no-route-geometry` (ESLint, error) — route files
  describe content, not page geometry. No `mx-auto`/`max-w-*`/top-level padding in
  `apps/*/src/routes/**`; geometry belongs to the shell/layout components.
- Formatting/lint otherwise via Biome (`biome.json`).

## Git workflow

- **Full lifecycle, self-driven:** branch (worktree — the checkout is usually dirty) →
  commit → push → PR against `main` → `gh pr merge N --squash --delete-branch` after
  self-verification → pull the operator checkout `/Users/benjamincrane/rare-structure-hq` →
  verify `git log -1 --oneline`. Merged ≠ done until the operator checkout reflects it.
- **Commit by explicit path only** — the operator routinely has uncommitted demo work in the
  tree. NEVER stage, commit, revert, or edit `apps/platform-app/src/demo/` or `DemoTour`
  without explicit instruction.
