/**
 * Engagement templates — the Settings "Engagement Templates" render surface's BFF.
 *
 *   GET  /api/v1/engagement-templates              selectable (brand, path, archetype, version)
 *   POST /api/v1/engagement-templates/render       render plain (default) → presigned PDF URL
 *   POST /api/v1/engagement-templates/render-push  render + create a Documenso template
 *
 * Thin operator-scoped broker (requireUser): authenticate the operator, attach the edge_api service
 * token, forward verbatim. edge_api owns the shape and ALL logic — this layer does NO field mapping,
 * so every field edge_api returns (and every field the SPA sends) flows straight through. The SPA
 * consumes edge_api's snake_case shape directly.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeListEngagementTemplates,
  edgeRenderEngagementTemplate,
  edgeRenderPushTemplate,
} from "../lib/edge.ts";

export const engagementTemplateRoutes = new Hono<{ Variables: AuthVariables }>();

function edge502(e: unknown): never {
  if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
  throw e;
}

// Selectable templates for the Settings dropdowns (brand → path → archetype → version).
engagementTemplateRoutes.get("/", requireUser, async (c) => {
  try {
    return c.json({ data: await edgeListEngagementTemplates() });
  } catch (e) {
    edge502(e);
  }
});

// Render the selected template to a clean PDF (plain by default) → presigned URL. No Documenso.
engagementTemplateRoutes.post("/render", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Parameters<
    typeof edgeRenderEngagementTemplate
  >[0];
  try {
    return c.json({ data: await edgeRenderEngagementTemplate(body) });
  } catch (e) {
    edge502(e);
  }
});

// Render the selected template AND create a Documenso template from the PDF. A tokenized template's
// operator values ride in `body.values` and are forwarded as-is; edge_api derives + bakes them.
engagementTemplateRoutes.post("/render-push", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Parameters<
    typeof edgeRenderPushTemplate
  >[0];
  try {
    return c.json({ data: await edgeRenderPushTemplate(body) });
  } catch (e) {
    edge502(e);
  }
});
