/**
 * Engagement mandate drafts — the direct-to-documenso Originate Mandate stamp.
 *
 *   POST /api/v1/engagement-mandate-drafts   (operator)  stamp { opportunityId, documensoTemplateId }
 *
 * In `direct-to-documenso` mode, "Originate Mandate" inserts one row into
 * `business.engagement_mandate_draft_content` (the gated replacement for createProposal). This BFF
 * only brokers the operator-scoped write across the auth boundary to edge_api.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeCreateMandateDraft } from "../lib/edge.ts";

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
