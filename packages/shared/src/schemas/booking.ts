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
 * The domain-keyed company dossier (`business.company_profiles`) — the firmographics + enrichment
 * the profile page renders, resolved by the booking's `domain`. Null until the company is enriched;
 * hand-seeded today, refreshed by a parallel.ai/cal projection later.
 */
export const companyProfileSchema = z.object({
  domain: z.string(),
  company: z.string().nullable(),
  hq: z.string().nullable(),
  headcount: z.string().nullable(),
  estRevenueRange: z.string().nullable(),
  overview: z.string().nullable(),
  focus: z.array(z.string()),
  industries: z.array(z.string()),
  geographies: z.array(z.string()),
  source: z.string().nullable(),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

/**
 * BFF → operator: the full booking-profile read. The summary plus the cal system identifiers
 * (stable iCalUID + the live cal booking/event-type ids), the meeting window, and the company
 * dossier (`profile`) resolved by domain. `profile` is null until the company is enriched.
 */
export const bookingDetailSchema = bookingSummarySchema.extend({
  icalUid: z.string().nullable(),
  calBookingId: z.number().nullable(),
  eventTypeId: z.number().nullable(),
  endTime: isoTimestampSchema.nullable(),
  bookedAt: isoTimestampSchema.nullable(),
  updatedAt: isoTimestampSchema.nullable(),
  profile: companyProfileSchema.nullable(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
