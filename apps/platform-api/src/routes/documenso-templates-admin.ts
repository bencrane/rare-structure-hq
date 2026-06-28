/**
 * Documenso templates — the Settings → Documenso → Manage Templates table.
 *
 *   GET /api/v1/documenso-templates   (operator)  every template for the operator's org
 *
 * Lists core-x `business.documenso_templates` (active AND archived), SCOPED to the signed-in
 * operator's email domain (so an @rarestructure.com operator sees only Rare Structure templates).
 * Distinct from `/engagement-mappings` (visible + mapped + active only — the prospect picker).
 * Returns [] if the registry is unreachable — the table reflects the engine.
 */
import { Hono } from "hono";

import type { DocumensoTemplateSummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { edgeListDocumensoTemplates, edgeSetDefaultDocumensoTemplate } from "../lib/edge.ts";

export const documensoTemplateRoutes = new Hono<{ Variables: AuthVariables }>();

documensoTemplateRoutes.get("/", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  try {
    const rows = await edgeListDocumensoTemplates(domain);
    const data: DocumensoTemplateSummary[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      isDefault: r.is_default,
      archetypeName: r.archetype_name,
    }));
    return c.json({ data });
  } catch {
    return c.json({ data: [] });
  }
});

// Mark one template as the org's Confirm & Originate default. Org is the signed-in operator's email
// domain; edge_api enforces active-only + org ownership (404 → surfaced as 502 here).
documensoTemplateRoutes.post("/default", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  const body = (await c.req.json().catch(() => ({}))) as { documensoTemplateId?: unknown };
  const id = typeof body.documensoTemplateId === "string" ? body.documensoTemplateId : "";
  if (!id) return c.json({ error: "documensoTemplateId required" }, 400);
  try {
    await edgeSetDefaultDocumensoTemplate(domain, id);
    return c.json({ default: id });
  } catch {
    return c.json({ error: "set default failed" }, 502);
  }
});
