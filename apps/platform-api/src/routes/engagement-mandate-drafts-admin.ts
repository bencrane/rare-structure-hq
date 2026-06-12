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
  edgeGetMandateDraftDocument,
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

// "Confirm & originate" — instantiate the Documenso document from the draft's template.
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
