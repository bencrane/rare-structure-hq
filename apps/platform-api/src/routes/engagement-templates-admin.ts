/**
 * Engagement templates — the Settings "Engagement Templates" render surface's BFF.
 *
 *   GET  /api/v1/engagement-templates           selectable (path, archetype, version)
 *   POST /api/v1/engagement-templates/render    render plain (default) → presigned PDF URL
 *
 * Operator-scoped (requireUser). edge_api owns the repo-resident template tree + the DocRaptor render
 * (NO Documenso); this BFF brokers the service-token call and normalizes the shape (snake → camel).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  type EdgeEngagementTemplate,
  type EdgeEngagementTemplateRender,
  EdgeError,
  edgeListEngagementTemplates,
  edgeRenderEngagementTemplate,
} from "../lib/edge.ts";

export const engagementTemplateRoutes = new Hono<{ Variables: AuthVariables }>();

function toClient(t: EdgeEngagementTemplate) {
  return {
    path: t.path,
    archetype: t.archetype,
    version: t.version,
    name: t.name,
    defaultStyle: t.default_style,
    stylesAvailable: t.styles_available,
  };
}

function toRenderClient(r: EdgeEngagementTemplateRender) {
  return {
    pdfUrl: r.pdf_url,
    expiresSeconds: r.expires_seconds,
    path: r.path,
    archetype: r.archetype,
    version: r.version,
    style: r.style,
    pdfBytes: r.pdf_bytes,
  };
}

// Selectable templates for the Settings dropdowns (path → archetype → version).
engagementTemplateRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListEngagementTemplates();
    return c.json({ data: rows.map(toClient) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Render the selected template to a clean PDF (plain by default) → presigned URL. No Documenso.
engagementTemplateRoutes.post("/render", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    path?: string;
    archetype?: string;
    version?: string;
    style?: string;
  } | null;
  if (!body?.path || !body.archetype || !body.version) {
    throw new HTTPException(400, { message: "path, archetype, and version are required" });
  }
  try {
    const result = await edgeRenderEngagementTemplate({
      path: body.path,
      archetype: body.archetype,
      version: body.version,
      style: body.style,
    });
    return c.json({ data: toRenderClient(result) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
