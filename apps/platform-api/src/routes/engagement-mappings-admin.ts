/**
 * Engagement mappings — the Dossier engagement picker.
 *
 *   GET /api/v1/engagement-mappings   (operator)  visible mappings for the operator's org
 *
 * Prospect-facing engagement options from `business.engagement_documenso_template_mappings`
 * where `is_visible` is true, SCOPED to the signed-in operator's email domain (so an
 * @activeoperators.com operator sees only Active Operators mappings). Keyed by the underlying
 * content-config slug (the value a minted proposal stores as `template_id`), so origination is
 * unaffected. Returns [] if the registry is unreachable — the picker reflects the table.
 */
import { Hono } from "hono";

import type { ProposalTemplateMeta } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { edgeListEngagementMappings } from "../lib/edge.ts";

export const engagementMappingRoutes = new Hono<{ Variables: AuthVariables }>();

engagementMappingRoutes.get("/", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  try {
    const rows = await edgeListEngagementMappings(domain);
    const data: ProposalTemplateMeta[] = rows.map((r) => ({
      id: r.id,
      label: r.label,
      fields: [],
    }));
    return c.json({ data });
  } catch {
    return c.json({ data: [] });
  }
});

// Engagement options for the picker — the operator-org's visible templates, each annotated with its
// archetype (the form's shape) and text_fields (the form's inputs). Empty on any failure. Consumed by
// the Documenso field-defaults editor. (Relocated here from the removed engagement-mandate-drafts router.)
engagementMappingRoutes.get("/options", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  try {
    const rows = await edgeListEngagementMappings(domain);
    const data = rows.map((r) => ({
      id: r.id,
      label: r.label,
      archetypeKey: r.archetype_key,
      archetypeName: r.archetype_name,
      performanceFeeBasis: r.performance_fee_basis,
      textFields: r.text_fields,
    }));
    return c.json({ data });
  } catch {
    return c.json({ data: [] });
  }
});
