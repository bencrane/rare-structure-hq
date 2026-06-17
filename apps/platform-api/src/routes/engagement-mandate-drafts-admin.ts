/**
 * Engagement mandate drafts — the direct-to-documenso Originate Mandate flow.
 *
 *   POST /api/v1/engagement-mandate-drafts                  (operator) stamp { opportunityId, documensoTemplateId }
 *   POST /api/v1/engagement-mandate-drafts/:id/confirm      (operator) instantiate the Documenso document
 *   GET  /api/v1/engagement-mandate-drafts/document/:eid    (PUBLIC)   prospect reads the signer token
 *
 * In `direct-to-documenso` mode, "Originate Mandate" inserts one row into
 * `business.engagement_mandate_draft_content`, and "Confirm & originate" instantiates a signable
 * Documenso document from the draft's template (edge_api owns the /envelope/use call). This BFF
 * brokers the operator-scoped writes across the auth boundary; the prospect's document read is
 * PUBLIC — the envelope id is the capability, exactly like the proposal `ref`.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeConfirmMandateDraft,
  edgeCreateMandateDraft,
  edgeGetEnvelopeState,
  edgeGetMandateDraftDocument,
  edgeGetStagingDraft,
  edgeListEngagementMappings,
  edgeOriginatePrefilled,
  edgeUpsertStagingDraft,
} from "../lib/edge.ts";

export const engagementMandateDraftRoutes = new Hono<{ Variables: AuthVariables }>();

engagementMandateDraftRoutes.post("/", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    opportunityId?: string;
    documensoTemplateId?: string;
  } | null;
  if (!body?.opportunityId || !body?.documensoTemplateId) {
    throw new HTTPException(400, {
      message: "opportunityId and documensoTemplateId are required",
    });
  }
  try {
    const res = await edgeCreateMandateDraft({
      opportunity_id: body.opportunityId,
      documenso_template_id: body.documensoTemplateId,
    });
    return c.json({ data: res });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// ── Mandate staging (the per-opportunity prep page) ──────────────────────────
// Engagement options for the staging picker — the operator-org's visible templates, each annotated
// with its archetype (the form's shape) and text_fields (the form's inputs). Empty on any failure.
engagementMandateDraftRoutes.get("/options", requireUser, async (c) => {
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

// Load the opportunity's staged mandate (selected template + entered values) to resume editing.
engagementMandateDraftRoutes.get("/by-opportunity/:opportunityId", requireUser, async (c) => {
  const opportunityId = c.req.param("opportunityId");
  try {
    const draft = await edgeGetStagingDraft(opportunityId);
    return c.json({
      data: draft
        ? {
            id: draft.id,
            documensoTemplateId: draft.documenso_template_id,
            archetypeId: draft.archetype_id,
            prefillValues: draft.prefill_values,
            status: draft.status,
          }
        : null,
    });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Save the prep page: create-or-update the opportunity's staging draft. Org + archetype are
// resolved server-side from the selected template (never trusted from the client).
engagementMandateDraftRoutes.put("/by-opportunity/:opportunityId", requireUser, async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const body = (await c.req.json().catch(() => null)) as {
    documensoTemplateId?: string;
    prefillValues?: Record<string, string>;
  } | null;
  if (!body?.documensoTemplateId) {
    throw new HTTPException(400, { message: "documensoTemplateId is required" });
  }
  try {
    const res = await edgeUpsertStagingDraft(opportunityId, {
      documenso_template_id: body.documensoTemplateId,
      prefill_values: body.prefillValues ?? {},
    });
    return c.json({ data: res });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// "Confirm & originate" — ENVELOPE-DISTRIBUTE lane: instantiate the Documenso document from the
// draft's template (/envelope/use + distribute). The default direct-to-documenso lane.
engagementMandateDraftRoutes.post("/:id/confirm", requireUser, async (c) => {
  const id = c.req.param("id");
  try {
    const res = await edgeConfirmMandateDraft(id);
    return c.json({
      data: {
        envelopeId: res.envelope_id,
        signingToken: res.signing_token,
        documensoHost: res.documenso_host,
      },
    });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// "Confirm & originate" — PREFILL-DOCUMENT-FROM-TEMPLATE lane (PARALLEL to /confirm, additive):
// instantiate a Documenso document from the draft's template via /api/v2/template/use, prefilled from
// opportunity_specific_content, then distribute(NONE) → the new envelope lands PENDING (no email).
// Same downstream shape as /confirm (envelopeId + signingToken), plus the `status`.
engagementMandateDraftRoutes.post("/:id/originate-prefilled", requireUser, async (c) => {
  const id = c.req.param("id");
  try {
    const res = await edgeOriginatePrefilled(id);
    return c.json({
      data: {
        envelopeId: res.envelope_id,
        documentId: res.document_id,
        signingToken: res.signing_token,
        documensoHost: res.documenso_host,
        status: res.status,
      },
    });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// PUBLIC — the prospect's signing surface reads its token + status here. The envelope id is the
// capability; no operator session (no requireUser), matching the proposal `ref` read model.
engagementMandateDraftRoutes.get("/document/:envelopeId", async (c) => {
  const envelopeId = c.req.param("envelopeId");
  try {
    const doc = await edgeGetMandateDraftDocument(envelopeId);
    if (!doc) throw new HTTPException(404, { message: "document not found" });
    return c.json({
      data: {
        signingToken: doc.signing_token,
        documensoHost: doc.documenso_host,
        status: doc.status,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// PUBLIC — the prospect poll. While the embed is shown MandateSignPage polls this; `signed` flips
// true once a terminal DOCUMENT_COMPLETED webhook lands for the envelope, and the page advances to
// the signed-confirmation view. Same capability model as the document read (envelope id = the key);
// proxies edge_api's /api/v1/documenso/envelope/:id/state (derived from the raw webhook capture).
engagementMandateDraftRoutes.get("/document/:envelopeId/state", async (c) => {
  const envelopeId = c.req.param("envelopeId");
  try {
    const state = await edgeGetEnvelopeState(envelopeId);
    if (!state) throw new HTTPException(404, { message: "envelope not found" });
    return c.json({
      data: {
        envelopeId: state.envelope_id,
        signed: state.signed,
        latestEvent: state.latest_event,
        status: state.status,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
