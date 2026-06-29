/**
 * Documenso template prefill config — the "Manage Documenso Templates" editor's BFF.
 *
 *   GET  /api/v1/documenso-template-prefill/:id   mirror-sourced fields + operator field_settings
 *   PUT  /api/v1/documenso-template-prefill/:id   write the operator-owned field_settings
 *
 * Thin operator-scoped broker (requireUser): authenticate the operator, attach the edge_api service
 * token, forward verbatim to edge_api's /api/v1/documenso-template-prefill/* endpoints. edge_api owns
 * the shape and ALL logic. The field SET comes from the MIRROR (business.documenso_envelopes,
 * type='template'); `field_settings` is the OPERATOR-OWNED prefill config in
 * business.documenso_template_document_prefill_configs — this editor is its ONLY writer, and the
 * webhook projector / mirror resync NEVER touch it. `field_settings` is keyed by field LABEL and
 * stores an ARBITRARY dict per label (Phase 2 adds "source"); edge_api persists whatever is sent, so
 * this layer does NO field mapping — edge_api's snake_case flows straight through to the SPA.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeGetTemplatePrefillConfig,
  edgePutTemplatePrefillConfig,
} from "../lib/edge.ts";

export const documensoTemplatePrefillRoutes = new Hono<{ Variables: AuthVariables }>();

function edge502(e: unknown): never {
  if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
  throw e;
}

function parseDocumensoId(raw: string): number {
  const documensoId = Number.parseInt(raw, 10);
  if (!Number.isInteger(documensoId)) {
    throw new HTTPException(400, { message: "id must be a documenso_id integer" });
  }
  return documensoId;
}

// Mirror-sourced fields + the operator-owned field_settings for one template.
documensoTemplatePrefillRoutes.get("/:id", requireUser, async (c) => {
  const documensoId = parseDocumensoId(c.req.param("id"));
  try {
    return c.json({ data: await edgeGetTemplatePrefillConfig(documensoId) });
  } catch (e) {
    edge502(e);
  }
});

// Write the operator-owned field_settings (label → arbitrary dict). edge_api persists whatever is sent.
documensoTemplatePrefillRoutes.put("/:id", requireUser, async (c) => {
  const documensoId = parseDocumensoId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const fieldSettings = (body as { field_settings?: unknown } | null)?.field_settings;
  if (fieldSettings == null || typeof fieldSettings !== "object" || Array.isArray(fieldSettings)) {
    throw new HTTPException(400, { message: "field_settings must be an object" });
  }
  try {
    return c.json({
      data: await edgePutTemplatePrefillConfig(
        documensoId,
        fieldSettings as Record<string, unknown>,
      ),
    });
  } catch (e) {
    edge502(e);
  }
});
