/**
 * rare-structure-hq platform-api — Hono BFF for the signed-in app.
 *
 * Responsibilities:
 * - Validate rare-structure-hq Supabase JWTs (ES256 + JWKS)
 * - /health (unauthenticated) for liveness probes
 * - /api/v1/me (auth-required) resolved identity: validated user + org affiliation
 * - /api/v1/settings (auth-required) operator settings (originate render_mode toggle)
 * - /api/v1/proposal-templates (auth) the non-revealing posture catalog
 * - /api/v1/award-profile/:domain (auth-required) brokers to core-x catalyst_api
 * - /api/v1/federal/* (PUBLIC) warm map/chart snapshot — in-memory, no Lance/DuckDB
 *
 * Deferred: Recipient profile, project matching.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Me } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "./auth.ts";
import { allowedOrigins, env } from "./env.ts";
import { db } from "./lib/db.ts";
import { awardProfileRoutes } from "./routes/award-profile.ts";
import { bookingAdminRoutes } from "./routes/bookings-admin.ts";
import { companyProfileRoutes } from "./routes/company-profiles-admin.ts";
import { dealAdminRoutes } from "./routes/deals-admin.ts";
import { documensoPublicRoutes } from "./routes/documenso-public.ts";
import { documensoTemplateDefaultRoutes } from "./routes/documenso-template-defaults.ts";
import { documensoTemplateFieldRoutes } from "./routes/documenso-template-fields-admin.ts";
import { documensoTemplateMirrorRoutes } from "./routes/documenso-template-mirror.ts";
import { documensoTemplatePrefillRoutes } from "./routes/documenso-template-prefill.ts";
import { documensoTemplateRoutes } from "./routes/documenso-templates-admin.ts";
import { engagementMappingRoutes } from "./routes/engagement-mappings-admin.ts";
import { engagementTemplateRoutes } from "./routes/engagement-templates-admin.ts";
import { federalRoutes } from "./routes/federal.ts";
import { insightsAdminRoutes } from "./routes/insights-admin.ts";
import { marketRoutes } from "./routes/market.ts";
import { marketCollectionsRoutes } from "./routes/market-collections.ts";
import { marketSpecRoutes } from "./routes/market-spec.ts";
import { proposalTemplateEditorRoutes } from "./routes/proposal-templates-admin.ts";
import { proposalTemplateRoutes } from "./routes/proposals-admin.ts";
import { settingsRoutes } from "./routes/settings.ts";

const app = new Hono<{ Variables: AuthVariables & { requestId: string } }>();

// Gzip every response >1 KB (Hono default threshold). The /api/v1/federal/ask map payload is
// large, repetitive JSON (~85-90% smaller gzipped) crossing the public internet to the cockpit;
// registered outermost so it wraps every downstream route. The prod runtime is Bun (Dockerfile
// oven/bun) which provides the Web CompressionStream global this relies on.
app.use("*", compress());

app.use("*", requestId());

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({ status: "ok", app_env: env.APP_ENV, ts: new Date().toISOString() }),
);

// `/api/v1/me` — the resolved identity for the signed-in user. The client reads coarse
// persona (operator vs client) from the JWT (`app_metadata.role`); this payload carries the
// ORG affiliation, resolved through the `business.*` tables via the read-only SECURITY
// DEFINER `resolve_org_identity` (business.* is not PostgREST-exposed, so the BFF reaches it
// through a public function on its service-role client). Degrades to `org: null` on failure —
// the portal then falls back to the house brand rather than erroring.
type IdentityRow = {
  org_id: string;
  org_name: string;
  org_slug: string | null;
  org_domain: string | null;
  org_role: string | null;
  platform_role: string | null;
};

app.get("/api/v1/me", requireUser, async (c) => {
  const user = c.get("user");

  let org: Me["org"] = null;
  let platformRole: string | null = null;

  const { data, error } = await db().rpc("resolve_org_identity", {
    p_auth_user_id: user.user_id,
  });
  if (error) {
    console.error(`[me] resolve_org_identity failed for ${user.user_id}: ${error.message}`);
  } else {
    const row = (Array.isArray(data) ? data[0] : null) as IdentityRow | null;
    if (row) {
      platformRole = row.platform_role ?? null;
      org = {
        id: row.org_id,
        name: row.org_name,
        slug: row.org_slug ?? null,
        domain: row.org_domain ?? null,
        role: row.org_role ?? null,
      };
    }
  }

  const me: Me = {
    userId: user.user_id,
    email: user.email,
    appEnv: env.APP_ENV,
    platformRole,
    org,
  };
  return c.json(me);
});

app.route("/api/v1/settings", settingsRoutes);
// Authoring surface mounts BEFORE the bare picker so the more specific prefix wins.
app.route("/api/v1/proposal-templates/manage", proposalTemplateEditorRoutes);
app.route("/api/v1/proposal-templates", proposalTemplateRoutes);
app.route("/api/v1/award-profile", awardProfileRoutes);
app.route("/api/v1/bookings", bookingAdminRoutes);
app.route("/api/v1/deals", dealAdminRoutes);
app.route("/api/v1/engagement-mappings", engagementMappingRoutes);
// Manage Templates table — every documenso_template for the org (active + archived). Registered
// before the `/api/v1/documenso` mount; the segment differs so there is no prefix collision.
app.route("/api/v1/documenso-templates", documensoTemplateRoutes);
// Direct-to-documenso public prospect surface (sign token/state + ACH payment).
app.route("/api/v1/documenso", documensoPublicRoutes);
app.route("/api/v1/engagement-templates", engagementTemplateRoutes);
app.route("/api/v1/documenso-template-fields", documensoTemplateFieldRoutes);
// Documenso template mirror — projected envelope rows + on-demand re-grab (through the existing
// projector). Distinct segment from the `/api/v1/documenso` mount, so no prefix collision.
app.route("/api/v1/documenso-template-mirror", documensoTemplateMirrorRoutes);
// Manage Documenso Templates — operator-owned per-template field_settings prefill config (the ONLY
// writer of business.documenso_template_document_prefill_configs). Distinct segment from the
// `/api/v1/documenso` mount, so no prefix collision.
app.route("/api/v1/documenso-template-prefill", documensoTemplatePrefillRoutes);
// Set Template as Default — the MIRROR-template default picker. Lists business.documenso_envelopes
// templates each flagged is_default and sets the operator's Confirm & Originate default (recorded in
// the operator-owned business.documenso_template_defaults). Replaces the legacy documenso-templates
// registry picker for mirror-path templates. Distinct segment from `/api/v1/documenso`, no collision.
app.route("/api/v1/documenso-template-defaults", documensoTemplateDefaultRoutes);
app.route("/api/v1/company-profiles", companyProfileRoutes);
// Insights — the operator's live call cockpit. Brokers the offline Close "now dialing" read
// from edge_api; the Insights tab polls /active-call and surfaces the briefing on domain change.
app.route("/api/v1/insights", insightsAdminRoutes);
// Market — the audience-builder cockpit tab. requireUser-gated dumb proxy to edge_api's
// /api/v1/audience/* (cohort queries + the Close push flow); bodies and statuses verbatim.
app.route("/api/v1/market", marketRoutes);
// Market-spec — the live market-definition instrument (Market tab). requireUser-gated
// dumb proxy to edge_api's /api/v1/market-spec/* (sidecar-served spec counts).
app.route("/api/v1/market-spec", marketSpecRoutes);
// Market collections — the 22 durable pair-defined collections (Market tab).
// requireUser-gated proxy to edge_api's /api/v1/market-collections/*.
app.route("/api/v1/market-collections", marketCollectionsRoutes);
// PUBLIC federal map/chart surface — warm in-memory snapshot, no auth (the cockpit /map
// route is public). Read-only projections of precomputed public federal-spend data.
app.route("/api/v1/federal", federalRoutes);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8000;
console.log(`platform-api listening on :${port} [${env.APP_ENV}]`);

serve({ fetch: app.fetch, port });
