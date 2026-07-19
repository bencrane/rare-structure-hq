# lander — Bun + Hono memorandum-page service. Railway builds from the repo
# root: `docker build -f apps/lander/Dockerfile <repo-root>`.
#
# Same shape as platform-api: the whole repo is copied so every workspace
# member's package.json is present for the root install; runtime executes
# from source. Doppler CLI fetches secrets at startup via DOPPLER_TOKEN
# injected by Railway.

FROM dopplerhq/cli:3 AS doppler

FROM oven/bun:1.3-alpine AS base
COPY --from=doppler /bin/doppler /usr/local/bin/doppler

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

WORKDIR /app/apps/lander

# Railway injects $PORT at runtime; default to 8090 for local docker runs.
EXPOSE 8090
CMD ["doppler", "run", "--", "bun", "start"]
