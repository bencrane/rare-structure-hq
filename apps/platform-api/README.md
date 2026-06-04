# platform-api

Hono BFF for the rare-structure-hq signed-in app.

## What it does

- Validates Supabase JWTs (ES256 via JWKS) issued by the `hq-rare-structure-hq` Supabase project
- `/health` — unauthenticated liveness probe
- `/api/v1/me` — returns the authenticated user's `user_id`, `email`, and `app_env`
- `/api/v1/award-profile/:domain` — broker to the core-x `catalyst_api` (Gen-3 read API):
  resolves a web domain to its US federal award profile. The user's Supabase JWT is
  validated here, then the BFF calls core-x with the internal operator token
  (`COREX_SERVICE_TOKEN`) over the private network — core-x is never exposed to the
  public web. `?awards=N` adds up to N prime award line items. The `{ data }` envelope
  passes through verbatim.

Deferred: Recipient profile, project matching.

## Local dev

```bash
# From monorepo root
bun install

# Secrets via Doppler (project: hq-rare-structure-hq, config: prd or dev)
doppler run --project hq-rare-structure-hq --config dev -- bun run dev
```

## Env vars

Injected by Doppler at runtime. All `RSH_*` keys live in the `hq-rare-structure-hq` Doppler project.

| Key | Description |
|-----|-------------|
| `RSH_SUPABASE_URL` | Supabase project URL |
| `RSH_SUPABASE_JWKS_URL` | JWKS endpoint for JWT verification |
| `RSH_SUPABASE_ISSUER` | Expected JWT issuer |
| `RSH_SUPABASE_ANON_KEY` | Supabase anon key |
| `RSH_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `COREX_API_URL` | core-x `catalyst_api` base URL (private: `http://catalyst-api.railway.internal:8080`) |
| `COREX_SERVICE_TOKEN` | operator token presented to core-x as Bearer (matches its `CATALYST_API_TOKEN`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `APP_ENV` | `prd` \| `stg` \| `dev` |

`PORT` is injected by Railway, not Doppler. Defaults to `8000` locally.

## Deployment

Railway service: `rare-structure-hq-platform-api`
Doppler: `hq-rare-structure-hq / prd`

After Railway creates the service, set `DOPPLER_TOKEN`:
```bash
doppler configs tokens create prd-railway --project hq-rare-structure-hq --config prd --plain
```
