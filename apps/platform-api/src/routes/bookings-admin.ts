/**
 * Bookings — the operator Pipeline list surface.
 *
 *   GET /api/v1/bookings   (operator)  recent cal.com bookings, most recent first
 *
 * Bookings are appended in core-x (`corex.bookings`) by the cal.com webhook consumer;
 * this BFF only brokers the operator-scoped read across the auth boundary to edge_api.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { BookingSummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeListBookings } from "../lib/edge.ts";

export const bookingAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /api/v1/bookings — operator-facing list (most recent first) for the Pipeline tab.
// Auth-gated. Delegates to the engine (edge_api → corex.bookings).
bookingAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListBookings();
    const list: BookingSummary[] = rows.map((r) => ({
      bookingId: r.booking_id,
      calEventUid: r.cal_event_uid,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      companyName: r.company_name,
      domain: r.domain,
      title: r.title,
      status: r.status,
      startTime: r.start_time,
      createdAt: r.created_at ?? new Date().toISOString(),
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
