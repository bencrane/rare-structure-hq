import { z } from "zod";
import { isoTimestampSchema } from "./common";

/**
 * Proposal instantiation contract — shared by platform-api and platform-app.
 *
 * The one-click-instantiate surface: operator mints a proposal on a call → client
 * signs/pays at a capability link (`/p/:ref`).
 *
 * Two artifacts, decoupled:
 *  - the legal instrument (the full agreement — rendered by core-x edge_api:
 *    DocRaptor → Documenso, and signed there);
 *  - the shell (this lean projection: exec summary + headline terms + sign).
 * Headline rows are SNAPSHOTTED at create time, so the shell is self-consistent
 * with what was bound at instantiation and immune to later registry edits.
 */

/** Lifecycle of a proposal record. Internal — nested inside `proposalShellSchema`. */
const proposalStatusSchema = z.enum(["created", "sent", "signed", "paid"]);

/** Input kind of an operator-filled dynamic var. Internal — nested inside `proposalTemplateFieldSchema`. */
const proposalFieldKindSchema = z.enum(["text", "email", "longtext"]);

/**
 * One operator-filled dynamic var for a template. The form a template renders is
 * exactly this list — the form contract is dictated by the chosen template.
 */
export const proposalTemplateFieldSchema = z.object({
  /** Data alias this value binds to in the agreement template. */
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

/** One success-fee tier — label + display rate (e.g. "5.0%"). Internal — nested inside `proposalPricingSchema`. */
const successFeeTierSchema = z.object({ tier: z.string(), rate: z.string() });

/**
 * The STRUCTURED pricing the mandate editor binds to: seeded from the shell, edited (or not), and
 * sent back on Confirm. `billingCadence` is permissive on read (never breaks the shell parse).
 */
const proposalPricingSchema = z.object({
  monthlyFeeCents: z.number().int().nonnegative(),
  durationMonths: z.number().int().positive(),
  billingCadence: z.string(),
  successFeeTiers: z.array(successFeeTierSchema),
});

/** One grok-at-a-glance term row shown on the shell. Internal — nested inside `proposalShellSchema`. */
const headlineRowSchema = z.object({ label: z.string(), value: z.string() });

/**
 * BFF → client shell: the lean public projection of a proposal. No internal cast
 * ids, no operator id, no full legal text — that lives in the rendered agreement.
 */
export const proposalShellSchema = z.object({
  ref: z.string(),
  status: proposalStatusSchema,
  templateLabel: z.string(),
  client: z.object({ name: z.string(), title: z.string().optional() }),
  execSummary: z.string(),
  headline: z.array(headlineRowSchema),
  /**
   * Structured pricing — what the operator's mandate editor binds its inputs to (the headline rows
   * are the derived display of these). Operator-only in practice; the prospect `Shell` ignores it.
   */
  pricing: proposalPricingSchema.optional(),
  createdAt: isoTimestampSchema,
  /**
   * Documenso recipient signing token (the engine's `signing_token`). Drives the
   * embedded `EmbedSignDocument`. Absent until the proposal's Documenso envelope is
   * provisioned (e.g. before the Documenso plan is live) — the shell then shows a
   * "preparing" state instead of the embed. The `ref` is the bearer for this token.
   */
  signingToken: z.string().optional(),
  /** Documenso instance host the embed points at — MUST match where the doc was created. */
  documensoHost: z.string().optional(),
  /** Agreement effective date (ISO ``YYYY-MM-DD``) — shown on the execution panel. */
  effectiveDate: z.string().optional(),
});
export type ProposalShell = z.infer<typeof proposalShellSchema>;
