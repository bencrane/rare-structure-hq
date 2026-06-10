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
 * A persisted dossier snapshot (`business.company_profile_snapshots`) — what the operator saved
 * on a "Save Profile" click. APPEND-ONLY: a domain accumulates many timestamped snapshots; the
 * Dossier loads the LATEST when one exists, else the `companyProfile` seed. A SUPERSET of the
 * seed — it also carries the Main Contact (signer/title/email) and the per-section Verified map.
 */
export const companyProfileSnapshotSchema = z.object({
  id: z.number(),
  domain: z.string(),
  company: z.string().nullable(),
  signerName: z.string().nullable(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  hq: z.string().nullable(),
  headcount: z.string().nullable(),
  estRevenueRange: z.string().nullable(),
  overview: z.string().nullable(),
  focus: z.array(z.string()),
  industries: z.array(z.string()),
  geographies: z.array(z.string()),
  verified: z.record(z.boolean()),
  savedBy: z.string().nullable(),
  createdAt: isoTimestampSchema.nullable(),
});
export type CompanyProfileSnapshot = z.infer<typeof companyProfileSnapshotSchema>;

/**
 * Operator → BFF: the Dossier form captured on Save Profile (the body; `domain` rides the URL).
 * Every field optional — a partially-filled dossier is savable.
 */
export const saveCompanyProfileSnapshotInputSchema = z.object({
  company: z.string().optional(),
  signerName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  hq: z.string().optional(),
  headcount: z.string().optional(),
  estRevenueRange: z.string().optional(),
  overview: z.string().optional(),
  focus: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  geographies: z.array(z.string()).default([]),
  verified: z.record(z.boolean()).default({}),
});
export type SaveCompanyProfileSnapshotInput = z.infer<typeof saveCompanyProfileSnapshotInputSchema>;

/**
 * BFF → operator: the full booking-profile read. The summary plus the cal system identifiers
 * (stable iCalUID + the live cal booking/event-type ids), the meeting window, the company
 * dossier (`profile`) resolved by domain, and the operator's `latestSnapshot` for that domain
 * (the page seeds from it when present). `profile`/`latestSnapshot` are null until enriched/saved.
 */
export const bookingDetailSchema = bookingSummarySchema.extend({
  icalUid: z.string().nullable(),
  calBookingId: z.number().nullable(),
  eventTypeId: z.number().nullable(),
  endTime: isoTimestampSchema.nullable(),
  bookedAt: isoTimestampSchema.nullable(),
  updatedAt: isoTimestampSchema.nullable(),
  profile: companyProfileSchema.nullable(),
  latestSnapshot: companyProfileSnapshotSchema.nullable(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
