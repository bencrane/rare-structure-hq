import { z } from "zod";
import { isoTimestampSchema } from "./common";

/**
 * Opportunity contract — shared by platform-api and platform-app.
 *
 * An opportunity is the CRM pipeline object (core-x `business.opportunities`),
 * materialized on a booking and joined to its account (company) + contact (person).
 * The Pipeline tab lists them; it is the first-class object that gets associated with
 * a Deal. `status` is a free string (not an enum) so pipeline stages can evolve without
 * breaking the read.
 */
export const opportunitySummarySchema = z.object({
  opportunityId: z.string(),
  /** 8-char public handle (`LEFT(opportunityId, 8)`) — the short URL key for the Application
   *  detail route. The full `opportunityId` (UUID) stays the server-side key for staging/originate. */
  handle: z.string(),
  status: z.string(),
  createdAt: isoTimestampSchema,
  companyName: z.string().nullable(),
  domain: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  title: z.string().nullable(),
  sourceBookingId: z.string().nullable(),
  bookedAt: isoTimestampSchema.nullable(),
});
export type OpportunitySummary = z.infer<typeof opportunitySummarySchema>;
