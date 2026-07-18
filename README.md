# rare-structure-hq

Rare Structure HQ monorepo. A catalyst-driven origination firm's platform:
four built applications on a shared design-system foundation.

## Applications

- `apps/platform-app` — the cockpit SPA (React 19 + Vite + react-router, dev on
  `:5173`). Sign-in-gated operator cockpit (Map · Demo · Overview · Market ·
  Applications · Insights · Settings tree), the internal `/viewer` data surface,
  and the public prospect `/p/*` signing/payment pages. Routes are code-split
  (`React.lazy`); only the sign-in gate ships in the entry chunk.
- `apps/platform-api` — the Hono BFF (Bun, `:8000` locally; deployed on
  Railway, config in `railway.json` + `Dockerfile`). Validates Supabase user
  JWTs (`HQX_*` project) and brokers internal service tokens to the two
  upstreams — the SPA never talks to an upstream directly. Env is zod-validated
  fail-fast at boot in `src/env.ts`; secrets come from Doppler
  (`hq-rare-structure-hq`, see `doppler.yaml`).
- `apps/marketing-site` — public marketing site (Vite, dev on `:5175`).
- `apps/marketing-site-ao` — the AO marketing site variant (Vite, dev on `:5174`).

## Two-upstream topology (platform-api)

- **catalyst_api** — the core-x read gateway: award profiles, entity dossiers,
  map/chart projections, market codes, market-spec counts, market collections,
  and the Q1 canonical-query surface. Reached under two env-name pairs that
  point at the same upstream (`COREX_API_URL`/`COREX_SERVICE_TOKEN` and
  `CATALYST_API_URL`/`CATALYST_API_TOKEN`), both zod-validated in `src/env.ts`.
- **edge_api** — the proposal/Documenso/automation engine (`EDGE_API_URL` +
  `EDGE_API_SERVICE_TOKEN`). `routes/market.ts` (the audience-builder push
  flow) is **intentionally** on edge_api: it is the write/push seam and stayed
  behind when composition reads moved to catalyst_api (core-x #1181).

## Packages

- `packages/tokens` — design tokens (`@rare-structure-hq/tokens`); single source
  of truth. `build.ts` emits CSS custom properties, a Tailwind theme, and typed
  TS exports from one token module.
- `packages/ui` — UI primitives (`@rare-structure-hq/ui`) + Storybook.
- `packages/shared` — Zod schemas (`@rare-structure-hq/shared`); the shared
  data seam between the SPA and the BFF.
- `packages/eslint-plugin-rare-structure-hq` — custom ESLint rules
  (`no-route-geometry`).

Design system is a four-layer model: tokens → primitives → shells → routes.
Routes describe content; primitives own geometry.

## Quickstart (dev)

```bash
bun install
bun run typecheck   # tsc over packages + the three Vite apps
bun run build       # tokens → ui → marketing-site → marketing-site-ao → platform-app
bun run lint        # eslint-plugin build + biome check + eslint over routes
bun run test        # package + app unit suites (incl. platform-api federal.test.ts,
                    # platform-app `bun test src/demo`)
bun run storybook   # primitive catalog on :6006

# apps individually
bun run --filter platform-api dev     # BFF on :8000 (needs Doppler env)
bun run --filter platform-app dev     # SPA on :5173
```

## CI

`.github/workflows/ci.yml`: typecheck → build → lint → Playwright e2e smoke
(`bun run test:e2e`, config in `e2e/`).

## Workspaces

Bun reads the `workspaces` array in `package.json` natively — there is no
`pnpm-workspace.yaml`. The toolchain floor is Bun >= 1.3 / Node >= 22.
