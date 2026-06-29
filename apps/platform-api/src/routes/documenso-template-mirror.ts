/**
 * Documenso template mirror — the Settings "Documenso Templates" mirror surface's BFF.
 *
 *   GET  /api/v1/documenso-template-mirror              the projected mirror table
 *   POST /api/v1/documenso-template-mirror/:id/resync   re-grab ONE template envelope
 *   POST /api/v1/documenso-template-mirror/resync-all   re-grab EVERY template envelope
 *
 * Thin operator-scoped broker (requireUser): authenticate the operator, attach the edge_api service
 * token, forward verbatim to edge_api's /api/v1/documenso-envelopes/* endpoints. edge_api owns the
 * shape and ALL logic — re-grab re-pulls through the EXISTING projector (documenso_client.get_envelope
 * → queries.upsert_envelope), verbatim semantics, and NEVER writes documenso_template_configs. This
 * layer does NO field mapping; edge_api's snake_case flows straight through to the SPA.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeListTemplateMirror,
  edgeResyncAllTemplates,
  edgeResyncTemplate,
} from "../lib/edge.ts";

export const documensoTemplateMirrorRoutes = new Hono<{ Variables: AuthVariables }>();

function edge502(e: unknown): never {
  if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
  throw e;
}

// The projected mirror of every Documenso template envelope.
documensoTemplateMirrorRoutes.get("/", requireUser, async (c) => {
  try {
    return c.json({ data: await edgeListTemplateMirror() });
  } catch (e) {
    edge502(e);
  }
});

// Re-grab ONE envelope: edge_api re-pulls it through the existing projector and upserts the mirror.
documensoTemplateMirrorRoutes.post("/:id/resync", requireUser, async (c) => {
  const documensoId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(documensoId)) {
    throw new HTTPException(400, { message: "id must be a documenso_id integer" });
  }
  try {
    return c.json({ data: await edgeResyncTemplate(documensoId) });
  } catch (e) {
    edge502(e);
  }
});

// Re-grab EVERY envelope through the existing projector.
documensoTemplateMirrorRoutes.post("/resync-all", requireUser, async (c) => {
  try {
    return c.json({ data: await edgeResyncAllTemplates() });
  } catch (e) {
    edge502(e);
  }
});
