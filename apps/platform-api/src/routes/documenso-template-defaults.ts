/**
 * Documenso template DEFAULT picker — the Settings → Documenso → "Set Template as Default" surface.
 *
 *   GET  /api/v1/documenso-template-defaults   the MIRROR templates, each flagged is_default
 *   POST /api/v1/documenso-template-defaults   mark one mirror template as the Confirm & Originate default
 *
 * Thin operator-scoped broker (requireUser): authenticate the operator, attach the edge_api service
 * token, forward verbatim to edge_api's /api/v1/documenso-template-defaults. edge_api owns the shape and
 * ALL logic — it reads business.documenso_envelopes (the verbatim mirror) and writes the operator-owned
 * business.documenso_template_defaults (the projector/re-grab never touch it). This layer does NO field
 * mapping; edge_api's snake_case flows straight through. Distinct from the LEGACY /api/v1/documenso-
 * templates registry picker — mirror-path templates (e.g. 14503) aren't in that registry.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeListTemplateDefaults, edgeSetTemplateDefault } from "../lib/edge.ts";

export const documensoTemplateDefaultRoutes = new Hono<{ Variables: AuthVariables }>();

function edge502(e: unknown): never {
  if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
  throw e;
}

// The MIRROR templates, each flagged with whether it is the operator's Confirm & Originate default.
documensoTemplateDefaultRoutes.get("/", requireUser, async (c) => {
  try {
    return c.json({ data: await edgeListTemplateDefaults() });
  } catch (e) {
    edge502(e);
  }
});

// Mark one mirror template as the Confirm & Originate default (by numeric documenso_id).
documensoTemplateDefaultRoutes.post("/", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { documensoId?: unknown };
  const documensoId = typeof body.documensoId === "number" ? body.documensoId : Number.NaN;
  if (!Number.isInteger(documensoId)) {
    throw new HTTPException(400, { message: "documensoId must be a documenso_id integer" });
  }
  try {
    await edgeSetTemplateDefault(documensoId);
    return c.json({ default: documensoId });
  } catch (e) {
    edge502(e);
  }
});
