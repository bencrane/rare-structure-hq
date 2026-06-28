import { z } from "zod";
import { isoTimestampSchema } from "./common";

/**
 * Deal contract — shared by platform-api and platform-app.
 *
 * A deal is the CRM pipeline object (core-x `business.deals`), one per account,
 * joined to its account (company) + contact (person). The Applications/Research tabs
 * list them. `status` is a free string (not an enum) so pipeline stages can evolve
 * without breaking the read.
 */
export const dealSummarySchema = z.object({
  dealId: z.string(),
  /** 8-char public handle (`LEFT(dealId, 8)`) — the short URL key for the Application
   *  detail route. The full `dealId` (UUID) stays the server-side key for staging/originate. */
  handle: z.string(),
  status: z.string(),
  createdAt: isoTimestampSchema,
  companyName: z.string().nullable(),
  domain: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  title: z.string().nullable(),
  lastBookingId: z.string().nullable(),
  bookedAt: isoTimestampSchema.nullable(),
});
export type DealSummary = z.infer<typeof dealSummarySchema>;
