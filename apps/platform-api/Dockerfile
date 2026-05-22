FROM oven/bun:1.3-slim AS base

# Install Doppler CLI for runtime secret injection
RUN apt-get update && apt-get install -y --no-install-recommends curl gnupg ca-certificates && \
    curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh && \
    apt-get purge -y --auto-remove curl gnupg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files needed for install
COPY bun.lock package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/platform-api/package.json ./apps/platform-api/

# Install only platform-api + its workspace deps
RUN bun install --frozen-lockfile --filter platform-api

# Copy source after install so source changes don't bust the install cache
COPY packages/shared ./packages/shared
COPY apps/platform-api ./apps/platform-api

WORKDIR /app/apps/platform-api

# Railway injects $PORT at runtime; default to 8000 for local docker runs.
EXPOSE 8000
CMD ["sh", "-c", "doppler run -- bun start"]
