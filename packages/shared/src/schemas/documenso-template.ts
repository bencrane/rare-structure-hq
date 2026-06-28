import { z } from "zod";

/**
 * Documenso template summary — a row of core-x `business.documenso_templates`, shared by
 * platform-api and platform-app. Backs the Settings → Documenso → Manage Templates table, which
 * lists EVERY template for the operator's org (active AND archived) — distinct from the engagement
 * picker, which shows only the visible, mapped, active ones. `id` is the external Documenso id.
 */
export const documensoTemplateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  status: z.string(),
  isDefault: z.boolean(),
  archetypeName: z.string().nullable(),
});
export type DocumensoTemplateSummary = z.infer<typeof documensoTemplateSummarySchema>;
