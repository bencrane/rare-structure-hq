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

import type { BookingDetail, BookingSummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeGetBooking, edgeListBookings } from "../lib/edge.ts";

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

// GET /api/v1/bookings/:id — one booking for the profile page. Auth-gated. Delegates to
// edge_api (corex.bookings), mapping the snake_case row onto the camelCase contract.
bookingAdminRoutes.get("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  let row: Awaited<ReturnType<typeof edgeGetBooking>>;
  try {
    row = await edgeGetBooking(id);
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
  if (!row) throw new HTTPException(404, { message: "booking not found" });
  const detail: BookingDetail = {
    bookingId: row.booking_id,
    icalUid: row.ical_uid,
    calEventUid: row.cal_event_uid,
    calBookingId: row.cal_booking_id,
    eventTypeId: row.event_type_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    companyName: row.company_name,
    domain: row.domain,
    title: row.title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    bookedAt: row.booked_at,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at,
    profile: row.profile
      ? {
          domain: row.profile.domain,
          company: row.profile.company,
          hq: row.profile.hq,
          headcount: row.profile.headcount,
          estRevenueRange: row.profile.est_revenue_range,
          overview: row.profile.overview,
          focus: row.profile.focus ?? [],
          industries: row.profile.industries ?? [],
          geographies: row.profile.geographies ?? [],
          source: row.profile.source,
        }
      : null,
  };
  return c.json({ data: detail });
});
