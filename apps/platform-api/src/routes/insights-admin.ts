/**
 * Insights — the operator's live call cockpit BFF surface.
 *
 * GET /api/v1/insights/active-call — the operator's current Close call, derived OFFLINE by
 * edge_api from the raw Close webhook events + the lead→domain crosswalk. NOT operator-scoped
 * (one operator; every login is "me"), but requireUser-gated so only a signed-in operator
 * session reaches it. The Insights tab polls this (~1.5s) and renders the company briefing when
 * the domain changes. Camel-cases the edge payload for the SPA, in the standard `{ data }` envelope.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeGetActiveCall } from "../lib/edge.ts";

export const insightsAdminRoutes = new Hono<{ Variables: AuthVariables }>();

insightsAdminRoutes.get("/active-call", requireUser, async (c) => {
  try {
    const e = await edgeGetActiveCall();
    return c.json({
      data: {
        active: e.active,
        companyName: e.company_name ?? null,
        normalizedDomain: e.normalized_domain ?? null,
        status: e.status ?? null,
        remotePhone: e.remote_phone ?? null,
        startedAt: e.started_at ?? null,
        closeLeadId: e.close_lead_id ?? null,
        resolvedContactId: e.resolved_contact_id ?? null,
      },
    });
  } catch (err) {
    if (err instanceof EdgeError) throw new HTTPException(502, { message: err.message });
    throw err;
  }
});
