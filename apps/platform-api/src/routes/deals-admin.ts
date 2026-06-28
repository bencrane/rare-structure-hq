/**
 * Applications / Research list surface — sourced from DEALS (`business.deals`).
 *
 *   GET /api/v1/deals   (operator)  pipeline list, most recent first
 *
 * The data is brokered from the core-x deals surface (edge_api `GET /api/v1/deals`) and mapped
 * onto the DealSummary shape (deal_id->dealId, deal_handle->handle, last_booking_id->lastBookingId).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { DealSummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeListDeals } from "../lib/edge.ts";

export const dealAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /api/v1/deals — operator-facing list (most recent first) for the Pipeline tab.
// Auth-gated. Delegates to the engine (edge_api → business.deals).
dealAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListDeals();
    const list: DealSummary[] = rows.map((r) => ({
      dealId: r.deal_id,
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
      lastBookingId: r.last_booking_id,
      bookedAt: r.booked_at,
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
