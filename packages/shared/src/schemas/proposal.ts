import { z } from "zod";
import { isoTimestampSchema } from "./common";

/**
 * Proposal instantiation contract — shared by platform-api and platform-app.
 *
 * This is the NEW one-click-instantiate surface (operator mints a proposal on a
 * call → client signs/pays at a capability link). It is intentionally distinct
 * from the legacy `ProposalDeal` fixture in platform-app's `routes/proposal`,
 * which backs the original `/proposal/:ref` page and is left untouched.
 *
 * Two artifacts, decoupled:
 *  - the Anvil document (the full legal instrument — the cast, instantiated);
 *  - the shell (this lean projection: exec summary + headline terms + sign).
 * Headline rows are SNAPSHOTTED at create time, so the shell is self-consistent
 * with what was bound into the cast and immune to later registry edits.
 */

/** Lifecycle of a proposal record. */
export const proposalStatusSchema = z.enum(["created", "sent", "signed", "paid"]);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

/** Input kind of an operator-filled dynamic var. */
export const proposalFieldKindSchema = z.enum(["text", "email", "longtext"]);
export type ProposalFieldKind = z.infer<typeof proposalFieldKindSchema>;

/**
 * One operator-filled dynamic var for a template. The form a template renders is
 * exactly this list — the form contract is dictated by the chosen template.
 */
export const proposalTemplateFieldSchema = z.object({
  /** Anvil cast data alias this value is bound to. */
  alias: z.string(),
  /** Operator-facing form label. */
  label: z.string(),
  kind: proposalFieldKindSchema.default("text"),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
});
export type ProposalTemplateField = z.infer<typeof proposalTemplateFieldSchema>;

/**
 * Operator-facing template metadata. Labels are deliberately NON-REVEALING — the
 * commercial posture (e.g. an aggressive fee schedule) is never named in the UI.
 */
export const proposalTemplateMetaSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  fields: z.array(proposalTemplateFieldSchema),
});
export type ProposalTemplateMeta = z.infer<typeof proposalTemplateMetaSchema>;

/** Operator → BFF: instantiate a proposal record. */
export const createProposalInputSchema = z.object({
  templateId: z.string().min(1),
  client: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    title: z.string().optional(),
  }),
  /** Any extra dynamic vars beyond client identity (template-specific). */
  fieldValues: z.record(z.string()).default({}),
});
export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;

/** BFF → operator: result of instantiating a proposal. */
export const createProposalResultSchema = z.object({
  ref: z.string(),
  /** Path only — the client prepends its own origin to form the shareable link. */
  path: z.string(),
});
export type CreateProposalResult = z.infer<typeof createProposalResultSchema>;

/** One grok-at-a-glance term row shown on the shell. */
export const headlineRowSchema = z.object({ label: z.string(), value: z.string() });
export type HeadlineRow = z.infer<typeof headlineRowSchema>;

/**
 * BFF → client shell: the lean public projection of a proposal. No internal cast
 * ids, no operator id, no full legal text — that lives in the Anvil document.
 */
export const proposalShellSchema = z.object({
  ref: z.string(),
  status: proposalStatusSchema,
  templateLabel: z.string(),
  client: z.object({ name: z.string(), title: z.string().optional() }),
  execSummary: z.string(),
  headline: z.array(headlineRowSchema),
  createdAt: isoTimestampSchema,
});
export type ProposalShell = z.infer<typeof proposalShellSchema>;

/** BFF → operator: one row in the proposals list (the cockpit tab). */
export const proposalSummarySchema = z.object({
  ref: z.string(),
  clientName: z.string(),
  templateLabel: z.string(),
  status: proposalStatusSchema,
  createdAt: isoTimestampSchema,
});
export type ProposalSummary = z.infer<typeof proposalSummarySchema>;
