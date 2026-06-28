/**
 * Applications / Research list surface — now sourced from DEALS (`business.deals`).
 *
 *   GET /api/v1/opportunities   (operator)  pipeline list, most recent first
 *
 * The route name is retained for SPA + signing-surface compatibility, but the data is brokered
 * from the core-x deals surface (edge_api `GET /api/v1/deals`) and mapped onto the existing
 * OpportunitySummary shape (deal_id->opportunityId, deal_handle->handle,
 * last_booking_id->sourceBookingId), so the SPA and the prospect-facing routes are unchanged.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { OpportunitySummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeListDeals } from "../lib/edge.ts";

export const opportunityAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /api/v1/opportunities — operator-facing list (most recent first) for the Pipeline tab.
// Auth-gated. Delegates to the engine (edge_api → business.opportunities).
opportunityAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListDeals();
    const list: OpportunitySummary[] = rows.map((r) => ({
      // Deals are the list source now. Map onto the existing OpportunitySummary shape:
      opportunityId: r.deal_id,
      // deal_handle is already the public 8-char key (LEFT(id,8)) — no slice needed.
      handle: r.deal_handle,
      status: r.status,
      createdAt: r.created_at ?? new Date().toISOString(),
      companyName: r.company_name,
      domain: r.domain,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      title: r.title,
      // The deal's most-recent booking — the detail page resolves handle -> booking -> company profile.
      sourceBookingId: r.last_booking_id,
      bookedAt: r.booked_at,
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
