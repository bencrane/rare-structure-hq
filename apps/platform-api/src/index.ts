/**
 * rare-structure-hq platform-api — Hono BFF for the signed-in app.
 *
 * Responsibilities:
 * - Validate rare-structure-hq Supabase JWTs (ES256 + JWKS)
 * - /health (unauthenticated) for liveness probes
 * - /api/v1/me (auth-required) resolved identity: validated user + org affiliation
 * - /api/v1/settings (auth-required) operator settings (originate render_mode toggle)
 * - /api/v1/proposals (auth) instantiate; /api/v1/proposals/:ref (public) shell read
 * - /api/v1/proposal-templates (auth) the non-revealing posture catalog
 * - /api/v1/award-profile/:domain (auth-required) brokers to core-x catalyst_api
 * - /api/v1/federal/* (PUBLIC) warm map/chart snapshot — in-memory, no Lance/DuckDB
 *
 * Deferred: Recipient profile, project matching.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Me } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "./auth.ts";
import { allowedOrigins, env } from "./env.ts";
import { db } from "./lib/db.ts";
import { awardProfileRoutes } from "./routes/award-profile.ts";
import { bookingAdminRoutes } from "./routes/bookings-admin.ts";
import { companyProfileRoutes } from "./routes/company-profiles-admin.ts";
import { documensoPublicRoutes } from "./routes/documenso-public.ts";
import { documensoTemplateFieldRoutes } from "./routes/documenso-template-fields-admin.ts";
import { engagementMandateDraftRoutes } from "./routes/engagement-mandate-drafts-admin.ts";
import { engagementMappingRoutes } from "./routes/engagement-mappings-admin.ts";
import { engagementTemplateRoutes } from "./routes/engagement-templates-admin.ts";
import { federalRoutes } from "./routes/federal.ts";
import { opportunityAdminRoutes } from "./routes/opportunities-admin.ts";
import { proposalTemplateEditorRoutes } from "./routes/proposal-templates-admin.ts";
import { proposalAdminRoutes, proposalTemplateRoutes } from "./routes/proposals-admin.ts";
import { settingsRoutes } from "./routes/settings.ts";

const app = new Hono<{ Variables: AuthVariables & { requestId: string } }>();

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
app.route("/api/v1/proposals", proposalAdminRoutes);
// Authoring surface mounts BEFORE the bare picker so the more specific prefix wins.
app.route("/api/v1/proposal-templates/manage", proposalTemplateEditorRoutes);
app.route("/api/v1/proposal-templates", proposalTemplateRoutes);
app.route("/api/v1/award-profile", awardProfileRoutes);
app.route("/api/v1/bookings", bookingAdminRoutes);
app.route("/api/v1/opportunities", opportunityAdminRoutes);
app.route("/api/v1/engagement-mappings", engagementMappingRoutes);
// Direct-to-documenso public prospect surface (sign token/state + ACH payment). Mirrors edge_api's
// own `documenso/*` namespace. Also mounted under the legacy `engagement-mandate-drafts` prefix below
// as a transitional alias so an in-flight SPA bundle on the old path keeps working across the
// independent platform-app / platform-api deploys — drop that alias once the new bundle is fully live.
app.route("/api/v1/documenso", documensoPublicRoutes);
app.route("/api/v1/engagement-mandate-drafts", documensoPublicRoutes);
// Operator-authenticated mandate-DRAFT CRUD.
app.route("/api/v1/engagement-mandate-drafts", engagementMandateDraftRoutes);
app.route("/api/v1/engagement-templates", engagementTemplateRoutes);
app.route("/api/v1/documenso-template-fields", documensoTemplateFieldRoutes);
app.route("/api/v1/company-profiles", companyProfileRoutes);
// PUBLIC federal map/chart surface — warm in-memory snapshot, no auth (the cockpit /map
// route is public). Read-only projections of precomputed public federal-spend data.
app.route("/api/v1/federal", federalRoutes);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8000;
console.log(`platform-api listening on :${port} [${env.APP_ENV}]`);

serve({ fetch: app.fetch, port });
