# bi-compute Auth Handshake — Security Audit

**Directive 43** · audit subject: authentication enforcement between `apps/platform-api` (Hono BFF) and the `bi-compute` Quack compute instance.
**Date:** 2026-06-03 · **Status:** audited against source on branch `claude/objective-williamson-ab3a68` (HEAD `e9c4019`) and the `bi-compute` repo (HEAD as of `2026-06-01`).

---

## TL;DR — Verdict

**The audited handshake does not exist.** `platform-api` never connects to `bi-compute`. There is no outbound request to `http://bi-compute:10000/quack`, no `QUACK_TOKEN` / `BI_COMPUTE_TOKEN` / `QUACK_AUTH_KEY` in the BFF's environment, and no such code path anywhere in the repo or its git history. The directive's premise is incorrect; the two services share no data plane.

Two separate questions, answered against reality:

| Question | Finding | Taxonomy |
|---|---|---|
| Is the `platform-api → bi-compute` handshake authenticated? | **No such handshake exists.** No connection, no token, no fetch. | N/A — not applicable |
| What actually guards `bi-compute`'s inbound plane? | A single shared token (`QUACK_TOKEN`) gates DuckDB's built-in `quack_serve()`, over **plain HTTP**, behind a Render **Private Service** boundary. **No operator-owned verification code and no operator-owned 401 path exist** — enforcement is delegated entirely to the closed-box Quack extension. | **Partially enforced** — token required, but verification is unverifiable-from-source and the load-bearing control is network isolation, not a provable header check. |

It is **not** a naked, tokenless connection — `QUACK_TOKEN` is required at boot and passed to the server. It is **not** fully enforced in any auditable sense — the operator owns zero lines of the verification logic, and the wire is unencrypted.

---

## Actual topology

```
platform-app (browser)
      │  Supabase JWT (Bearer)
      ▼
platform-api (Hono BFF) ──fetch──►  data-engine-x  (DEX_BASE_URL)   ← the ONLY outbound dependency
      │                              forwards the END-USER's Supabase JWT, not a service token
      ✗  no link to bi-compute

Metabase (embedded DuckDB)  ──CREATE SECRET(TYPE quack)+ATTACH 'quack:bi-compute:10000'──►  bi-compute
      │  Render regional private network (plain HTTP, QUACK_TOKEN)        │
      └─────────────────────────────────────────────────────────────────►  R2 Parquet + Lance
```

The real client of `bi-compute` is **Metabase's embedded DuckDB driver**, not the BFF. That hop lives in Metabase service configuration (a SaaS surface), so it is **not provable from any repo in this workspace** — `bi-compute/README.md:74-80` explicitly flags it as the one unverifiable link.

---

## Layer 1 — Hono outbound (`platform-api`)

**Scanned:** entire `apps/platform-api`, the whole `rare-structure-hq` worktree, sibling repos (`billing-engine-x-api`, `chat-package`, `comms-package`), and `apps/platform-api` git history.

| Check | Result | Evidence |
|---|---|---|
| Outbound request to `bi-compute:10000/quack` | **Absent** | grep `bi-compute\|quack\|:10000` across repo → 0 source matches; `git log -S` on `apps/platform-api` → never present |
| `QUACK_TOKEN` / `BI_COMPUTE_TOKEN` / `QUACK_AUTH_KEY` in env | **Absent** | [src/env.ts:14-24](../../apps/platform-api/src/env.ts) declares no such key |
| Token injected on outbound calls | **N/A** — no such calls | — |
| The only outbound `fetch` in the service | → **data-engine-x**, forwarding the **end-user's Supabase JWT** as `Authorization` Bearer | [src/routes/sam-opps.ts:39-52](../../apps/platform-api/src/routes/sam-opps.ts) |
| Secrets source | Doppler project `hq-rare-structure-hq`, config `prd` | [doppler.yaml](../../apps/platform-api/doppler.yaml), `doppler run -- bun start` in [railway.json](../../apps/platform-api/railway.json) |

**Env var key the directive asked to identify:** none. `platform-api`'s declared secrets are `RSH_SUPABASE_*`, `DEX_BASE_URL`, and `DEX_SERVICE_TOKEN` ([src/env.ts:14-24](../../apps/platform-api/src/env.ts)). There is no Quack/bi-compute token because there is no Quack/bi-compute call.

**Incidental finding (out of audit scope, flagged for hygiene):** `DEX_SERVICE_TOKEN` is required at boot (`z.string().min(1)`, [src/env.ts:21](../../apps/platform-api/src/env.ts)) but is **never read by any handler** — the `sam-opps` broker forwards the user's JWT instead ([src/routes/sam-opps.ts:30-37,52](../../apps/platform-api/src/routes/sam-opps.ts)). It is a required-but-unused secret: it can block boot if unset, yet protects nothing. Either wire it in or drop it from the schema.

---

## Layer 2 — Quack inbound (`bi-compute`)

**Scanned:** the entire `bi-compute` repo (`start_quack.sh`, `Dockerfile`, `render.yaml`, `README.md`). There is **no application server code** — the inbound handler is DuckDB's built-in `quack_serve()` core extension (DuckDB 1.5.3).

| Check | Result | Evidence |
|---|---|---|
| Inbound auth gate | Shared token `QUACK_TOKEN`, passed as `token := '${QUACK_TOKEN}'` to `quack_serve()` | [start_quack.sh:55](../../../bi-compute/start_quack.sh) |
| Token required at boot | Yes — fail-fast if unset; min length **4 chars** | [start_quack.sh:20-25](../../../bi-compute/start_quack.sh) |
| **Operator-owned header verification** | **None** — no custom request handler exists | entire repo: no server source, only the `quack_serve()` call |
| **Explicit HTTP 401 on token mismatch** | **Not present in operator code** — rejection behavior is internal to the Quack extension and not exposed/asserted here | — |
| Transport | **Plain HTTP**, TLS disabled | `disable_ssl := true` — [start_quack.sh:55](../../../bi-compute/start_quack.sh) |
| Bind / reachability | `0.0.0.0:10000`, `allow_other_hostname := true` | [start_quack.sh:55](../../../bi-compute/start_quack.sh) |
| Network boundary | Render **Private Service** (`type: pserv`) — no public URL | [render.yaml:8](../../../bi-compute/render.yaml) |
| `QUACK_TOKEN` source | Render dashboard env (`sync: false`), sourced from Doppler `hq-x/prd` | [render.yaml:25-26](../../../bi-compute/render.yaml) |

**Interpretation.** A token *is* configured and *is* mandatory — so this is not a tokenless open port. But every line of actual verification (compare presented token to configured token, reject on mismatch, choose the status code) lives **inside the third-party Quack extension**, not in any code the operator can read, test, or audit. The repo asserts the gate exists (`README.md:66-67`) but cannot demonstrate it. The directive's required guarantee — "if the incoming token does not match, explicitly exit 401" — is **not provable from source**; it is an assumed property of the extension.

---

## What is actually protecting the data plane

Ranked by how much weight each control bears today:

1. **Network isolation (load-bearing).** `bi-compute` is a Render Private Service with no public URL; only same-region peers on the private network can open `:10000` ([render.yaml:8](../../../bi-compute/render.yaml), README "Security & topology"). This is the primary, and effectively the only *verifiable*, boundary.
2. **Shared token (secondary, unverifiable).** `QUACK_TOKEN` gates `quack_serve()`, but enforcement is delegated to the extension and unprovable here; min-strength floor is a weak 4 chars.
3. **Transport (absent).** Plain HTTP — any peer that reaches the private network sees token and query traffic in cleartext. A compromised co-tenant or a future cross-region/public exposure removes control #1 and leaves only the unverifiable #2 over an unencrypted wire.

---

## Risk register

| # | Risk | Severity | Note |
|---|---|---|---|
| R1 | Token verification + 401 behavior is unauditable (delegated to closed-box extension) | Medium | Cannot prove a spoofed token is rejected; mitigated only by network isolation |
| R2 | Plain HTTP on the wire (`disable_ssl := true`) | Medium | Token + data in cleartext on the private network; no defense if the network boundary is breached |
| R3 | `QUACK_TOKEN` min length 4 chars | Low–Medium | Trivially brute-forceable if the port is ever reachable; Quack's own floor, not raised here |
| R4 | Security depends on a single network control with no provable app-layer fallback | Medium | A misconfig flipping the service to public-facing collapses to R1+R2+R3 simultaneously |
| R5 | (`platform-api`) `DEX_SERVICE_TOKEN` required-but-unused | Low | Boot-blocking secret that guards nothing; see Layer 1 |

---

## Recommendations

Ordered by blast radius, not effort:

1. **Prove the gate or stop claiming it.** Add a deploy-time assertion to `bi-compute` boot that runs an unauthenticated and a wrong-token `ATTACH` against `127.0.0.1:10000` and fails the deploy unless both are rejected. This converts the assumed 401 into a tested invariant — the only way to close R1 without forking the extension.
2. **Strengthen the token.** Set `QUACK_TOKEN` to ≥32 random chars in Doppler `hq-x/prd`. The 4-char floor is a footgun.
3. **Keep the private-network invariant explicit.** Treat the `pserv` type in [render.yaml](../../../bi-compute/render.yaml) as a security control: never promote to a public service without first fronting Quack with a TLS-terminating proxy (per `README.md:70-72`). Encode this as a review gate.
4. **If `bi-compute` ever serves a non-DuckDB client** (e.g. the BFF), do not reuse the plain-HTTP shared-token model — terminate TLS and verify a scoped token in operator-owned middleware, returning a real 401.
5. **Resolve `DEX_SERVICE_TOKEN`** (R5): wire it into the `sam-opps` broker if DEX expects a service identity, or delete it from [src/env.ts](../../apps/platform-api/src/env.ts).

---

## Scope note

This audit proves a negative for the `platform-api → bi-compute` link (no connection exists in source or history) and characterizes the `bi-compute` inbound posture from its full repo. The `Metabase → bi-compute` hop — the actual client — is configured inside the Metabase service and is **outside the source visible to this workspace**; it must be validated operationally (the `duckdb -c "CREATE SECRET … ATTACH …"` probe in `bi-compute/README.md:79-80`), not by code review.
