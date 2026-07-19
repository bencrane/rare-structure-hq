# lander — access.governmentcontracted.com

Per-prospect **private memorandum** pages: a self-hosted video (the operator
querying the prospect's market) plus the market's shape — counts, dollars,
size bands. Shape only; firm names are held for the call. Minted on demand
after a prospect opts in over email.

## Architecture

- **No database.** Pages are baked HTML on R2 (`data-sink/landers/pages/<token>.html`);
  the object key is the token registry. Revocation = delete the object
  (a warm instance may serve its in-memory copy for up to 5 more minutes).
- **Service** (`src/index.ts`, Bun + Hono): `GET /x/:token` serves the page
  (5-min in-memory cache, `noindex` everywhere); `GET /m/:file` streams media
  from R2 with Range support (video seeking); `POST /v/:token` appends view
  telemetry (`landers/views/<token>/…`, hashed UA/IP, per-IP rate limited);
  `GET /healthz`.
- **Secrets**: Doppler `hq-rare-structure-hq/prd` — `R2_ENDPOINT`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (+ optional `LANDER_BUCKET`,
  `LANDER_PREFIX`, `LANDER_BASE_URL`).

## Operator workflow (post-opt-in)

```bash
cd apps/lander

# once per vertical: upload the recorded video (key gets a random suffix)
doppler run -- bun scripts/media.ts ~/Downloads/equipment-loom.mp4

# per prospect: mint against the baked fixture, get the URL, reply with it
doppler run -- bun scripts/mint.ts --name "gear up" --media <key-from-above>

# before the call: did they watch?
doppler run -- bun scripts/views.ts <token>

# housekeeping
doppler run -- bun scripts/mint.ts --list
doppler run -- bun scripts/mint.ts --revoke <token>
```

The equipment fixture is `~/Desktop/hq/data-cache/equipment/yard-markets.json`
(885 providers, baked by `bake_equipment_yard_markets.py`). Other verticals:
pass `--fixture` once their bakes exist.

## Local dev (no R2)

```bash
mkdir -p /tmp/lander-dev/{pages,media}
bun scripts/mint.ts --uei DDWUEXGZVGA5 --media placeholder.mp4 --local /tmp/lander-dev
LANDER_LOCAL_DIR=/tmp/lander-dev bun run dev   # :8090
```

## Deploy

Railway service in the rshq project, built from this repo's root with
`apps/lander/Dockerfile` (watch path `apps/lander/**`). Custom domain
`access.governmentcontracted.com` (CNAME at the registrar → Railway target).
