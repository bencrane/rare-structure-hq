/**
 * Engagement mandates — the PARALLEL engagement-document pathway's operator surface.
 *
 *   GET  /api/v1/engagement-mandates/packages          (operator)  price+term dropdown options
 *   POST /api/v1/engagement-mandates/:opportunityId    (operator)  lock a package → enqueue render
 *   GET  /api/v1/engagement-mandates/:opportunityId    (operator)  the opportunity's mandate state
 *
 * Distinct from engagement-mandate-drafts (staging draft → Documenso). edge_api binds the opportunity
 * + the locked price/term package into the static AO term-only HTML and renders a plain PDF via
 * DocRaptor (fired through a Trigger.dev task). This BFF only brokers the operator-scoped action
 * across the auth boundary (service token to edge_api).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeGenerateMandate,
  edgeGetMandate,
  edgeListEngagementPackages,
} from "../lib/edge.ts";

export const engagementMandateAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /packages — the preset price+term options for the Applications action dropdown.
engagementMandateAdminRoutes.get("/packages", requireUser, async (c) => {
  try {
    return c.json({ data: await edgeListEngagementPackages() });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// POST /:opportunityId — lock a package on the opportunity and enqueue its mandate render.
engagementMandateAdminRoutes.post("/:opportunityId", requireUser, async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const body = (await c.req.json().catch(() => ({}))) as { packageKey?: unknown };
  const packageKey = typeof body.packageKey === "string" ? body.packageKey : "";
  if (!packageKey) throw new HTTPException(400, { message: "packageKey is required" });
  try {
    return c.json({ data: await edgeGenerateMandate(opportunityId, packageKey) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// GET /:opportunityId — the opportunity's current mandate state (null when nothing staged yet).
engagementMandateAdminRoutes.get("/:opportunityId", requireUser, async (c) => {
  const opportunityId = c.req.param("opportunityId");
  try {
    return c.json({ data: await edgeGetMandate(opportunityId) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
