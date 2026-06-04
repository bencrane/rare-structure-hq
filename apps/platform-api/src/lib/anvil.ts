/**
 * Anvil Etch e-sign integration for the proposal surface.
 *
 * The API key + cast config are read from the environment (Doppler) lazily, so
 * the BFF still boots without Anvil configured — only the proposal e-sign
 * routes fail, and with a clear error. The key NEVER leaves this server.
 */
import Anvil from "@anvilco/anvil";

let client: Anvil | null = null;
function anvilClient(): Anvil {
  if (client) return client;
  const apiKey = process.env.ANVIL_API_KEY_DEV;
  if (!apiKey) throw new AnvilError("ANVIL_API_KEY_DEV is not configured", 500);
  client = new Anvil({ apiKey });
  return client;
}

// The proposal PDF template (an Anvil "cast") + the client's signature field.
// Defaults point at the strategic_origination_mandate template; override via
// env to repoint at a different cast/version (e.g. a real "v1") with no code
// change. These are not secrets — they're template identifiers.
const CAST_EID = process.env.ANVIL_PROPOSAL_CAST_EID ?? "u4xqZ9ENuvGyfq4qo5eT";
// Signature fields detected on the v1 template (page 2). The client is the
// embedded signer (Rare Structure counter-signs "7da75937…" separately).
// Override via env if the cast/template changes.
const CLIENT_SIG_FIELD =
  process.env.ANVIL_CLIENT_SIG_FIELD ?? "1684d126-d007-403d-9b04-dcb21062ad2d";
const CLIENT_SIG_DATE_FIELD =
  process.env.ANVIL_CLIENT_SIG_DATE_FIELD ?? "6b1d8fc8-e307-4e16-b5f9-16e66462dea0";

export class AnvilError extends Error {
  statusCode: number;
  detail: unknown;
  constructor(message: string, statusCode = 502, detail?: unknown) {
    super(message);
    this.name = "AnvilError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export interface ProposalSigner {
  name: string;
  email: string; // required by Anvil even for embedded signers (no email is sent)
  title?: string;
}

export interface ProposalPacket {
  etchPacketEid: string;
  documentGroupEid: string;
  signerEid: string;
}

/**
 * Create an Etch packet for a proposal against the cast template, with a single
 * EMBEDDED client signer (signerType 'embedded' => Anvil sends no email).
 * Returns the signerEid the sign-url step consumes.
 */
export async function createProposalPacket(
  ref: string,
  signer: ProposalSigner,
): Promise<ProposalPacket> {
  const isTest = process.env.APP_ENV !== "prd"; // real, billable packets only in prod
  const variables = {
    name: `Rare Structure Engagement — ${ref}`,
    isTest,
    isDraft: false,
    files: [{ id: "proposal", castEid: CAST_EID }],
    data: {
      payloads: {
        proposal: {
          data: {
            clientInstitutionalPartnerSignerName: signer.name,
            clientInstitutionalPartnerSignerTitle: signer.title ?? "",
            rareStructureLlcSignerName: "Rare Structure LLC",
          },
        },
      },
    },
    signers: [
      {
        id: "client",
        name: signer.name,
        email: signer.email,
        signerType: "embedded",
        fields: [
          { fileId: "proposal", fieldId: CLIENT_SIG_FIELD },
          { fileId: "proposal", fieldId: CLIENT_SIG_DATE_FIELD },
        ],
      },
    ],
  };

  // Anvil's createEtchPacket can blip transiently (rate limits, cold starts,
  // upstream 5xx). Retry a few times before surfacing a 502, and log the real
  // reason server-side — the client only ever sees a generic message.
  let lastDetail: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = (await anvilClient().createEtchPacket({ variables })) as {
        statusCode: number;
        data?: any;
        errors?: unknown;
      };
      if (res.errors) throw new AnvilError("createEtchPacket failed", res.statusCode, res.errors);
      const packet = res.data?.data?.createEtchPacket ?? res.data?.createEtchPacket;
      const signerEid = packet?.documentGroup?.signers?.[0]?.eid;
      if (!signerEid) throw new AnvilError("no signerEid in packet response", 502, res.data);
      return {
        etchPacketEid: packet.eid,
        documentGroupEid: packet.documentGroup?.eid,
        signerEid,
      };
    } catch (e) {
      lastDetail = e instanceof AnvilError ? e.detail : e;
      // eslint-disable-next-line no-console
      console.error(`createProposalPacket attempt ${attempt}/3 failed:`, JSON.stringify(lastDetail));
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw new AnvilError("createEtchPacket failed after retries", 502, lastDetail);
}

/** Generate a short-lived embedded signing URL for a signer (valid ~2h). */
export async function generateProposalSignUrl(
  signerEid: string,
  clientUserId: string,
): Promise<string> {
  const res = (await anvilClient().generateEtchSignUrl({
    variables: { signerEid, clientUserId },
  })) as { statusCode: number; url?: string; errors?: unknown };

  if (res.errors || !res.url) {
    throw new AnvilError("generateEtchSignUrl failed", res.statusCode ?? 502, res.errors ?? res);
  }
  return res.url;
}
