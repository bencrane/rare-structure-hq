/**
 * Proposal instantiation routes — the NEW one-click-instantiate surface.
 *
 * Kept separate from the legacy `routes/proposals.ts` (`:ref/packet`,
 * `:ref/sign-url`), which backs the original `/proposal/:ref` page and is left
 * untouched. Mounted alongside it at the same base in index.ts.
 *
 *   POST /api/v1/proposals        (operator)  instantiate a record → { ref, path }
 *   GET  /api/v1/proposals/:ref   (public)    the lean shell projection
 *   GET  /api/v1/proposal-templates (operator) the non-revealing posture list
 *
 * The Anvil packet is NOT created here — it is minted lazily at sign time
 * (record-aware, Phase 3) so the ~2h embedded sign URL never goes stale.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type ProposalShell, createProposalInputSchema } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { db } from "../lib/db.ts";
import { newProposalRef } from "../lib/ids.ts";
import { getTemplate, listTemplateMeta } from "../lib/proposal-templates.ts";

export const proposalAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// POST /api/v1/proposals — operator instantiates a proposal record. Auth-gated:
// only a signed-in operator may mint proposals.
proposalAdminRoutes.post("/", requireUser, async (c) => {
  const user = c.get("user");
  const parsed = createProposalInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  const input = parsed.data;
  const template = getTemplate(input.templateId);
  if (!template)
    throw new HTTPException(400, { message: `unknown templateId: ${input.templateId}` });

  // Posture-baked commercial values + operator-supplied dynamic vars + the
  // client identity bound to the cast's signer-name/title aliases. The posture
  // (template) carries the substance; client vars are cosmetic-bespoke.
  const fieldValues: Record<string, string> = {
    ...template.dataDefaults,
    ...input.fieldValues,
    clientInstitutionalPartnerSignerName: input.client.name,
    clientInstitutionalPartnerSignerTitle: input.client.title ?? "",
  };
  const headline = template.headline(fieldValues);
  const ref = newProposalRef();

  const { error } = await db()
    .from("proposals")
    .insert({
      ref,
      template_id: template.id,
      client_name: input.client.name,
      client_email: input.client.email ?? null,
      client_title: input.client.title ?? null,
      field_values: fieldValues,
      headline,
      exec_summary: template.execSummary,
      template_label: template.label,
      status: "created",
      created_by: user.user_id,
    });
  if (error) throw new HTTPException(500, { message: `insert failed: ${error.message}` });

  return c.json({ data: { ref, path: `/p/${ref}` } }, 201);
});

// GET /api/v1/proposals/:ref — public, ref-scoped read for the client shell. The
// ref is the capability credential, so no auth. Returns the lean projection only.
proposalAdminRoutes.get("/:ref", async (c) => {
  const ref = c.req.param("ref");
  const { data, error } = await db()
    .from("proposals")
    .select("ref,status,template_label,client_name,client_title,exec_summary,headline,created_at")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: "proposal not found" });

  const shell: ProposalShell = {
    ref: data.ref,
    status: data.status,
    templateLabel: data.template_label,
    client: { name: data.client_name, title: data.client_title ?? undefined },
    execSummary: data.exec_summary,
    headline: data.headline,
    createdAt: data.created_at,
  };
  return c.json({ data: shell });
});

// GET /api/v1/proposal-templates — operator-facing posture list (non-revealing).
export const proposalTemplateRoutes = new Hono<{ Variables: AuthVariables }>();
proposalTemplateRoutes.get("/", requireUser, (c) => c.json({ data: listTemplateMeta() }));
