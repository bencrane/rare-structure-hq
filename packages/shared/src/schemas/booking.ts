import { z } from "zod";
import { isoTimestampSchema } from "./common";

/**
 * Booking contract — shared by platform-api and platform-app.
 *
 * A booking is the normalized form of a cal.com BOOKING_CREATED event
 * (core-x `corex.bookings`, appended by the webhook consumer). The Pipeline tab
 * lists them; each row opens that company's dossier.
 *
 * `domain` is the canonical resolution key linking a booking to its company
 * dossier downstream — never email. It can be null until intake resolves it.
 */

/**
 * BFF → operator: one row in the Pipeline bookings list. `status` is a free
 * string (not an enum) so a new cal.com lifecycle value never breaks the read.
 */
export const bookingSummarySchema = z.object({
  bookingId: z.string(),
  calEventUid: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  companyName: z.string().nullable(),
  domain: z.string().nullable(),
  title: z.string().nullable(),
  status: z.string(),
  startTime: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type BookingSummary = z.infer<typeof bookingSummarySchema>;

/**
 * BFF → operator: the full booking-profile read. The summary plus the cal system identifiers
 * (stable iCalUID + the live cal booking/event-type ids) and the meeting window — everything
 * the cal booking gives us. Enrichment fields layer on later.
 */
export const bookingDetailSchema = bookingSummarySchema.extend({
  icalUid: z.string().nullable(),
  calBookingId: z.number().nullable(),
  eventTypeId: z.number().nullable(),
  endTime: isoTimestampSchema.nullable(),
  bookedAt: isoTimestampSchema.nullable(),
  updatedAt: isoTimestampSchema.nullable(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
