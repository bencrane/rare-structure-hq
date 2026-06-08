/**
 * Proposal template registry — the posture catalog.
 *
 * Each template binds a commercial POSTURE to the existing Anvil cast (the legal
 * instrument) plus the data values that posture fills. The operator selects a
 * posture by a deliberately NON-REVEALING label; the cast + success-fee tiers it
 * carries are the commercial substance. The client-specific vars (name/title)
 * are cosmetic-bespoke — they make the document feel specific, they are not the
 * commercial conditions. Adding a posture is config-only here: a new row, no new
 * cast, no code.
 *
 * Cast contract (strategic_origination_mandate, eid u4xqZ9ENuvGyfq4qo5eT) locked
 * from live Anvil introspection (apps/platform-api/scripts/anvil-find-cast.ts):
 *   client signature   1684d126-d007-403d-9b04-dcb21062ad2d  (page 2)
 *   client sign date   6b1d8fc8-e307-4e16-b5f9-16e66462dea0  (page 2)
 *   data aliases       first|second|third|fourth1000000SuccessFeePercentage,
 *                      clientInstitutionalPartnerSignerName / …Title,
 *                      rareStructureLlcSignerName
 */
import type {
  HeadlineRow,
  ProposalTemplateField,
  ProposalTemplateMeta,
} from "@rare-structure-hq/shared";

const CAST_EID = process.env.ANVIL_PROPOSAL_CAST_EID ?? "u4xqZ9ENuvGyfq4qo5eT";
const CLIENT_SIG_FIELD =
  process.env.ANVIL_CLIENT_SIG_FIELD ?? "1684d126-d007-403d-9b04-dcb21062ad2d";
const CLIENT_SIG_DATE_FIELD =
  process.env.ANVIL_CLIENT_SIG_DATE_FIELD ?? "6b1d8fc8-e307-4e16-b5f9-16e66462dea0";

/** Internal posture binding (server-only — never serialized to the operator). */
export interface ProposalTemplate {
  id: string;
  /** Operator-facing, non-revealing. */
  label: string;
  description?: string;
  castEid: string;
  /** Cast signature + date field ids assigned to the embedded CLIENT signer. */
  clientSignerFieldIds: string[];
  /** Extra operator-filled dynamic vars (the form contract). Often empty. */
  fields: ProposalTemplateField[];
  /** Posture-baked cast data values — the commercial substance (e.g. fee tiers). */
  dataDefaults: Record<string, string>;
  /** Snapshotted at create time → the shell's grok-at-a-glance term rows. */
  headline: (values: Record<string, string>) => HeadlineRow[];
  execSummary: string;
}

const EXEC_SUMMARY =
  "Rare Structure originates and structures senior capital against an active federal " +
  "revenue mandate and existing lender relationships. This engagement is success-based: " +
  "the fee schedule below applies only to capital that closes and funds.";

/** Render the success-fee tiers a posture carries into shell term rows. */
function feeHeadline(v: Record<string, string>): HeadlineRow[] {
  return [
    { label: "Engagement", value: "Strategic Origination Mandate" },
    { label: "First $1M — Success Fee", value: `${v.first1000000SuccessFeePercentage}%` },
    { label: "Second $1M — Success Fee", value: `${v.second1000000SuccessFeePercentage}%` },
    { label: "Third $1M — Success Fee", value: `${v.third1000000SuccessFeePercentage}%` },
    { label: "Fourth $1M+ — Success Fee", value: `${v.fourth1000000SuccessFeePercentage}%` },
  ];
}

const BASE_DEFAULTS: Record<string, string> = {
  rareStructureLlcSignerName: "Rare Structure LLC",
};

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: "strategic_origination_mandate_standard",
    label: "Standard Engagement",
    description: "Baseline success-fee schedule.",
    castEid: CAST_EID,
    clientSignerFieldIds: [CLIENT_SIG_FIELD, CLIENT_SIG_DATE_FIELD],
    fields: [],
    dataDefaults: {
      ...BASE_DEFAULTS,
      first1000000SuccessFeePercentage: "5",
      second1000000SuccessFeePercentage: "4",
      third1000000SuccessFeePercentage: "3",
      fourth1000000SuccessFeePercentage: "2",
    },
    headline: feeHeadline,
    execSummary: EXEC_SUMMARY,
  },
  {
    id: "strategic_origination_mandate_accelerated",
    label: "Accelerated Engagement",
    description: "Front-loaded success-fee schedule.",
    castEid: CAST_EID,
    clientSignerFieldIds: [CLIENT_SIG_FIELD, CLIENT_SIG_DATE_FIELD],
    fields: [],
    dataDefaults: {
      ...BASE_DEFAULTS,
      first1000000SuccessFeePercentage: "7",
      second1000000SuccessFeePercentage: "6",
      third1000000SuccessFeePercentage: "5",
      fourth1000000SuccessFeePercentage: "4",
    },
    headline: feeHeadline,
    execSummary: EXEC_SUMMARY,
  },
];

export function getTemplate(id: string): ProposalTemplate | undefined {
  return PROPOSAL_TEMPLATES.find((t) => t.id === id);
}

/** Strip the internal binding → the operator-facing metadata only. */
export function toMeta(t: ProposalTemplate): ProposalTemplateMeta {
  return { id: t.id, label: t.label, description: t.description, fields: t.fields };
}

export function listTemplateMeta(): ProposalTemplateMeta[] {
  return PROPOSAL_TEMPLATES.map(toMeta);
}
