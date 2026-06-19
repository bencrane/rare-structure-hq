/**
 * Proposal-template picker route.
 *
 *   GET /api/v1/proposal-templates (operator)  the non-revealing posture list
 *
 * The proposal create/confirm/list/read/send/pay surface (through-docraptor) has been removed;
 * the direct-to-documenso originate lane lives in engagement-mandate-drafts-admin.ts. This file
 * retains only the operator's published-template picker, which the Proposals intake form reads.
 */
import { Hono } from "hono";

import type { ProposalTemplateMeta } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { edgeTemplateList } from "../lib/edge.ts";

// GET /api/v1/proposal-templates — the operator's engagement picker for the Proposals intake form.
// PUBLISHED templates authored in Settings, SCOPED to the signed-in operator's org: the engine
// filters by the operator's email domain (org.metadata->>'domain'), so an @activeoperators.com
// operator sees only Active Operators templates, @rarestructure.com only Rare Structure, etc.
// Keyed by slug (the value a minted proposal stores as template_id). Returns [] if the registry
// is unreachable — the picker reflects the table, never stale built-in postures.
export const proposalTemplateRoutes = new Hono<{ Variables: AuthVariables }>();
proposalTemplateRoutes.get("/", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  try {
    const published = await edgeTemplateList(true, domain);
    const data: ProposalTemplateMeta[] = published
      .filter((t) => t.slug)
      .map((t) => ({ id: t.slug as string, label: t.name ?? (t.slug as string), fields: [] }));
    return c.json({ data });
  } catch {
    return c.json({ data: [] });
  }
});
