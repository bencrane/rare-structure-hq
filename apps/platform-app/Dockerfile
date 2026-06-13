# platform-app — Vite + React SPA. Railway builds this from the repo root:
# `docker build -f apps/platform-app/Dockerfile <repo-root>`.
# Classic Dockerfile — no BuildKit-only features (Railway's builder rejects
# `RUN --mount`); the uncached install is fine.
#
# Build-time env: Vite reads `VITE_*` env vars at build time and bakes
# them into dist/. DOPPLER_TOKEN is the ONLY service variable Railway
# provides; the build runs under `doppler run`, which pulls VITE_* from
# the Doppler prd config and injects them so `vite build` bakes them in.

FROM dopplerhq/cli:3 AS doppler

# ── build: install the workspace, build tokens, then build the Vite app ──────
# Bun reads the root package.json (workspaces: apps/*, packages/*); the whole
# repo is copied first so every member's package.json is present, then one
# install pass. @rare-structure-hq/tokens is a BUILT package — its dist/ is
# consumed by the app, src/index.css and the Tailwind preset — so it MUST be
# built before `vite build`. (@rare-structure-hq/ui and /shared are source-only.)
FROM oven/bun:1.3-alpine AS build
COPY --from=doppler /bin/doppler /usr/local/bin/doppler
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter @rare-structure-hq/tokens build
WORKDIR /app/apps/platform-app

# Build-time secret. DOPPLER_TOKEN is the only service variable Railway
# promotes into the build env; VITE_* are NOT expected from Railway —
# `doppler run` pulls them from the Doppler prd config below.
ARG DOPPLER_TOKEN
ENV DOPPLER_TOKEN=$DOPPLER_TOKEN

# Cache-bust for baked VITE_* values. Vite inlines VITE_* at build time, pulled
# from Doppler by `doppler run` — but a Doppler-only change (e.g. the
# api.rarestructure.com -> api.activeoperators.com cutover) does NOT invalidate
# the build layer below, so a plain Railway redeploy re-serves a stale bundle.
# Bump CACHEBUST whenever a baked VITE_* value changes to force a fresh build.
ARG CACHEBUST=2026-06-13-activeoperators

# Vite reads VITE_* from the env at build time; doppler run injects them
# from the prd config so they get baked into dist/.
RUN echo "cachebust ${CACHEBUST}" && doppler run -- bun run build

# ── runtime: serve the static dist/ via Express (serve.js) ───────────────────
# serve.js listens on process.env.PORT (Railway injects it). express is
# installed fresh here (correct-arch) and the app package.json is copied for
# its "type": "module" so serve.js loads as ESM.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --no-package-lock --no-save express@4.21.2
COPY --from=build /app/apps/platform-app/dist ./dist
COPY --from=build /app/apps/platform-app/serve.js ./serve.js
COPY --from=build /app/apps/platform-app/package.json ./package.json
EXPOSE 5173
CMD ["node", "serve.js"]
