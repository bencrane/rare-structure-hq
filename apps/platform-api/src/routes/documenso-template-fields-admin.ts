/**
 * Documenso template field defaults — the Settings "Documenso Templates" editor's BFF.
 *
 *   GET  /api/v1/documenso-template-fields?documensoTemplateId=   editable fields + current defaults
 *   POST /api/v1/documenso-template-fields/defaults               write defaults onto the template
 *
 * Operator-scoped (requireUser). edge_api reads/writes the LIVE Documenso template's fields; this BFF
 * brokers the service-token call and normalizes the field shape (snake → camel) for the client.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  type EdgeDocumensoTemplateField,
  EdgeError,
  edgeListDocumensoTemplateFields,
  edgeSaveDocumensoTemplateDefaults,
} from "../lib/edge.ts";

export const documensoTemplateFieldRoutes = new Hono<{ Variables: AuthVariables }>();

function toClient(r: EdgeDocumensoTemplateField) {
  return {
    id: r.id,
    type: r.type,
    label: r.label,
    recipientId: r.recipient_id,
    page: r.page,
    default: r.default,
  };
}

// The template's editable fields (+ current defaults), live from Documenso.
documensoTemplateFieldRoutes.get("/", requireUser, async (c) => {
  const documensoTemplateId = c.req.query("documensoTemplateId");
  if (!documensoTemplateId) {
    throw new HTTPException(400, { message: "documensoTemplateId is required" });
  }
  try {
    const rows = await edgeListDocumensoTemplateFields(documensoTemplateId);
    return c.json({ data: rows.map(toClient) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Write per-field default values onto the template; returns the refreshed field list.
documensoTemplateFieldRoutes.post("/defaults", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    documensoTemplateId?: string;
    defaults?: { id: number; value: string }[];
  } | null;
  if (!body?.documensoTemplateId || !Array.isArray(body.defaults)) {
    throw new HTTPException(400, { message: "documensoTemplateId and defaults are required" });
  }
  try {
    const rows = await edgeSaveDocumensoTemplateDefaults(body.documensoTemplateId, body.defaults);
    return c.json({ data: rows.map(toClient) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
