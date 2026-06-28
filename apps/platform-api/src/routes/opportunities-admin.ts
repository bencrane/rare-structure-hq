/**
 * Opportunities — the operator Pipeline list surface.
 *
 *   GET /api/v1/opportunities   (operator)  pipeline opportunities, most recent first
 *
 * Opportunities are materialized on a booking in core-x (`business.opportunities`);
 * this BFF only brokers the operator-scoped read across the auth boundary to edge_api.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { OpportunitySummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeListOpportunities } from "../lib/edge.ts";

export const opportunityAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /api/v1/opportunities — operator-facing list (most recent first) for the Pipeline tab.
// Auth-gated. Delegates to the engine (edge_api → business.opportunities).
opportunityAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListOpportunities();
    const list: OpportunitySummary[] = rows.map((r) => ({
      opportunityId: r.opportunity_id,
      // 8-char public handle (LEFT(uuid,8)) — the short URL key the Application detail route uses.
      handle: r.opportunity_id.slice(0, 8),
      status: r.status,
      createdAt: r.created_at ?? new Date().toISOString(),
      companyName: r.company_name,
      domain: r.domain,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      title: r.title,
      sourceBookingId: r.source_booking_id,
      bookedAt: r.booked_at,
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
