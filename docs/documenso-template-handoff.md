# Documenso Templates — Agent Handoff (canonical)

**Purpose of this session:** work with the operator to create a **new Documenso template** and wire it into the platform. Read this file, then the four files in "Read first." Do not scan wider until a specific task demands it.

## System shape (3 layers — memorize this)

```
platform-app (React SPA)  →  platform-api (Hono BFF, thin broker)  →  core-x apps/edge_api (Python, OWNS ALL LOGIC)
apps/platform-app             apps/platform-api                        /Users/benjamincrane/core-x/apps/edge_api
```

- **edge_api owns everything**: Documenso HTTP client, rendering (DocRaptor), webhook projection, and all `business.*` tables. The BFF authenticates the operator (Supabase JWT), attaches `EDGE_API_SERVICE_TOKEN`, and forwards **verbatim** — no field mapping anywhere in the BFF. edge_api's snake_case flows straight to the SPA.
- Documenso instance: `DOCUMENSO_APP_URL` (default `https://app.documenso.com`). Secrets via Doppler project `hq-rare-structure-hq`.
- Work from the **main checkouts** of both repos, not `.claude/worktrees/*` copies.

## The two lanes for creating a template

**Lane A — Render-push (platform-native).** An *engagement template* (HTML content pack in core-x `apps/edge_api/content/<brand>/docraptor-to-documenso-template/`) is rendered to PDF via DocRaptor, then pushed to Documenso as a template.
- BFF: `POST /api/v1/engagement-templates/render-push` ([engagement-templates-admin.ts](apps/platform-api/src/routes/engagement-templates-admin.ts))
- SPA: Settings → Engagement Templates ([EngagementTemplatesRender.tsx](apps/platform-app/src/routes/app/EngagementTemplatesRender.tsx), [EngagementTemplateToDocumenso.tsx](apps/platform-app/src/routes/app/EngagementTemplateToDocumenso.tsx))
- Selectable by (brand → path → archetype → version).

**Lane B — Documenso-first (mirror path).** Operator builds the template in the Documenso UI; the platform learns about it through the **mirror**: webhook projection + on-demand re-grab into `business.documenso_envelopes` (`type='template'`), verbatim.
- BFF: `GET /api/v1/documenso-template-mirror`, `POST .../:id/resync`, `POST .../resync-all` ([documenso-template-mirror.ts](apps/platform-api/src/routes/documenso-template-mirror.ts))
- SPA: Settings → Documenso Template Mirror ([DocumensoTemplateMirror.tsx](apps/platform-app/src/routes/app/DocumensoTemplateMirror.tsx))

Confirm with the operator which lane this new template uses before doing anything.

## Post-creation wiring (applies to either lane)

1. **Prefill config** — per-template, operator-owned `field_settings` keyed by field **LABEL**, stored in `business.documenso_template_document_prefill_configs`. The "Manage Documenso Templates" editor is its **only writer**; webhook projector and resync never touch it. Field SET comes from the mirror.
   - BFF: `GET/PUT /api/v1/documenso-template-prefill/:documensoId` ([documenso-template-prefill.ts](apps/platform-api/src/routes/documenso-template-prefill.ts))
   - SPA: [ManageDocumensoTemplates.tsx](apps/platform-app/src/routes/app/ManageDocumensoTemplates.tsx) at `/app/settings/manage-documenso-templates`
2. **Default picker** — mark the template as the "Confirm & Originate" default. Reads the mirror, writes operator-owned `business.documenso_template_defaults`.
   - BFF: `GET/POST /api/v1/documenso-template-defaults` ([documenso-template-defaults.ts](apps/platform-api/src/routes/documenso-template-defaults.ts))
   - SPA: [SettingsDocumenso.tsx](apps/platform-app/src/routes/app/SettingsDocumenso.tsx) at `/app/settings/documenso`
3. **Engagement mappings** — the prospect-facing picker (visible + mapped + active only): `/api/v1/engagement-mappings` ([engagement-mappings-admin.ts](apps/platform-api/src/routes/engagement-mappings-admin.ts)).

## Legacy vs. current — do not confuse

- `/api/v1/documenso-templates` ([documenso-templates-admin.ts](apps/platform-api/src/routes/documenso-templates-admin.ts)) is the **LEGACY registry** (`business.documenso_templates`, scoped by operator email domain). Mirror-path templates (e.g. documenso id `14503`) are **not** in it. Its SPA is [DocumensoTemplatesManage.tsx](apps/platform-app/src/routes/app/DocumensoTemplatesManage.tsx) at `/app/settings/documenso/templates`.
- The **current** default/prefill surfaces run off the **mirror** (`business.documenso_envelopes`). When in doubt: mirror-based routes (`documenso-template-mirror`, `-prefill`, `-defaults`) are current.
- Naming traps: `DocumensoTemplatesManage.tsx` (legacy table) ≠ `ManageDocumensoTemplates.tsx` (prefill editor, current). `DocumensoTemplatesEditor.tsx` is a separate editor at `/app/settings/documenso-templates`. Verify routing in [App.tsx](apps/platform-app/src/App.tsx) before editing any of them.

## Signer runtime (where the template is consumed)

- `/p/:ref` proposal summary → `/p/:ref/sign` Documenso embed ([DocumentSignPage.tsx](apps/platform-app/src/routes/p/DocumentSignPage.tsx), [DocumentFrame.tsx](apps/platform-app/src/proposals/DocumentFrame.tsx), theme in [documensoTheme.ts](apps/platform-app/src/proposals/documensoTheme.ts))
- `/p/t/...` embed **direct-template** lane — reusable Documenso DIRECT-TEMPLATE token; signer self-identifies; Documenso creates the document on completion ([DirectTemplateSignPage.tsx](apps/platform-app/src/routes/p/DirectTemplateSignPage.tsx))
- ACH payment on the same (opportunity, document) pair: [DocumentPaymentPage.tsx](apps/platform-app/src/routes/p/DocumentPaymentPage.tsx)
- Public BFF surface (unauthenticated; ref/opportunity-UUID is the capability): [documenso-public.ts](apps/platform-api/src/routes/documenso-public.ts)

## Read first (in order)

1. [apps/platform-api/src/lib/edge.ts](apps/platform-api/src/lib/edge.ts) — every edge_api call the BFF can make; env contract
2. [apps/platform-api/src/index.ts](apps/platform-api/src/index.ts) — route mounts + inline comments on each surface
3. [packages/shared/src/schemas/documenso-template.ts](packages/shared/src/schemas/documenso-template.ts) — shared shapes
4. [apps/platform-app/src/App.tsx](apps/platform-app/src/App.tsx) — which SPA page is wired to which path

Engine-side (only when the BFF surface is insufficient): core-x `apps/edge_api/src/documenso_templates/`, `documenso_projection/`, `documenso_prefill_configs/`, `documenso_template_defaults/`, content packs under `apps/edge_api/content/<brand>/docraptor-to-documenso-template/`.

## Local dev

```bash
# from rare-structure-hq root
bun install
doppler run --project hq-rare-structure-hq --config dev -- bun run dev   # per-app; see each app's doppler.yaml
```
