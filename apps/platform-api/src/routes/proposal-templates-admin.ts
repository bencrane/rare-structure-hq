/**
 * Proposal-template authoring routes — broker the operator's "Settings → Proposal Templates"
 * surface to core-x edge_api. Operator-auth (requireUser) on the front; service-token to the
 * engine. The BFF stays a dumb passthrough: edge_api owns markdown→HTML, the DocRaptor preview
 * (→ R2 presigned link), and the publish registry.
 *
 *   POST /api/v1/proposal-templates/manage/convert        markdown → HTML + detected {{tokens}}
 *   POST /api/v1/proposal-templates/manage/preview        render → DocRaptor → R2 → presigned PDF link
 *   POST /api/v1/proposal-templates/manage                create a draft
 *   GET  /api/v1/proposal-templates/manage                list (drafts + published)
 *   GET  /api/v1/proposal-templates/manage/:id            one template (markdown included)
 *   PUT  /api/v1/proposal-templates/manage/:id            update a draft
 *   POST /api/v1/proposal-templates/manage/:id/publish    name + slug → selectable in Proposals
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  EdgeError,
  edgeTemplateConvert,
  edgeTemplateCreate,
  edgeTemplateGet,
  edgeTemplateList,
  edgeTemplatePreview,
  edgeTemplatePublish,
  edgeTemplateUpdate,
} from "../lib/edge.ts";

export const proposalTemplateEditorRoutes = new Hono<{ Variables: AuthVariables }>();

// Every authoring route is operator-gated.
proposalTemplateEditorRoutes.use("*", requireUser);

function edgeFail(e: unknown): never {
  if (e instanceof EdgeError) {
    // The engine returns 409 on a slug already in use; surface it as a 409 so the UI can prompt.
    const status = /slug conflict/i.test(e.message) ? 409 : 502;
    throw new HTTPException(status, { message: e.message });
  }
  throw e;
}

proposalTemplateEditorRoutes.post("/convert", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json({
      data: await edgeTemplateConvert({
        markdown: body.markdown ?? "",
      }),
    });
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.post("/preview", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json({
      data: await edgeTemplatePreview({
        markdown: body.markdown ?? "",
        token_values: body.token_values ?? {},
      }),
    });
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = c.get("user");
  try {
    const row = await edgeTemplateCreate({
      markdown: body.markdown ?? "",
      name: body.name ?? null,
      created_by: user.user_id,
    });
    return c.json({ data: row }, 201);
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.get("/", async (c) => {
  const published = c.req.query("published") === "true";
  try {
    return c.json({ data: await edgeTemplateList(published) });
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.get("/:id", async (c) => {
  try {
    return c.json({ data: await edgeTemplateGet(c.req.param("id")) });
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json({
      data: await edgeTemplateUpdate(c.req.param("id"), {
        markdown: body.markdown,
        name: body.name,
      }),
    });
  } catch (e) {
    edgeFail(e);
  }
});

proposalTemplateEditorRoutes.post("/:id/publish", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    throw new HTTPException(400, { message: "name is required to publish" });
  }
  try {
    return c.json({
      data: await edgeTemplatePublish(c.req.param("id"), {
        name: body.name,
        slug: body.slug ?? null,
        monthly_fee_cents: body.monthly_fee_cents ?? null,
      }),
    });
  } catch (e) {
    edgeFail(e);
  }
});
