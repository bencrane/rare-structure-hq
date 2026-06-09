/**
 * Proposal template registry — the posture catalog.
 *
 * Each row is a commercial POSTURE the operator selects by a deliberately
 * NON-REVEALING label. The posture id drives the (hardcoded) infrastructure fee
 * in edge_api (`postureMonthlyFeeCents`); the legal instrument itself is rendered
 * by core-x edge_api (DocRaptor → Documenso). Adding a posture is config-only
 * here: a new row, no code.
 */
import type { ProposalTemplateField, ProposalTemplateMeta } from "@rare-structure-hq/shared";

/** Internal posture binding (server-only — never serialized verbatim to the operator). */
export interface ProposalTemplate {
  id: string;
  /** Operator-facing, non-revealing. */
  label: string;
  description?: string;
  /** Extra operator-filled dynamic vars (the form contract). Often empty. */
  fields: ProposalTemplateField[];
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: "strategic_origination_mandate_standard",
    label: "Standard Engagement",
    description: "Baseline success-fee schedule.",
    fields: [],
  },
  {
    id: "strategic_origination_mandate_accelerated",
    label: "Accelerated Engagement",
    description: "Front-loaded success-fee schedule.",
    fields: [],
  },
];

/** Strip the internal binding → the operator-facing metadata only. */
export function toMeta(t: ProposalTemplate): ProposalTemplateMeta {
  return { id: t.id, label: t.label, description: t.description, fields: t.fields };
}

export function listTemplateMeta(): ProposalTemplateMeta[] {
  return PROPOSAL_TEMPLATES.map(toMeta);
}
