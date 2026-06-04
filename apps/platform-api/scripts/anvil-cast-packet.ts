/**
 * Validate the cast-based createEtchPacket shape the /packet endpoint will use:
 * reference the proposal cast by eid, fill its data fields, and assign an
 * EMBEDDED client signer to a signature field. Prints signerEid + status.
 *
 *   doppler run -p hq-rare-structure-hq -c prd -- bun run scripts/anvil-cast-packet.ts
 *
 * Overrides: ANVIL_PROPOSAL_CAST_EID, ANVIL_CLIENT_SIG_FIELD
 */
import Anvil from "@anvilco/anvil";

const apiKey = process.env.ANVIL_API_KEY_DEV;
if (!apiKey) {
  console.error("✗ ANVIL_API_KEY_DEV missing — run via `doppler run`.");
  process.exit(1);
}
const anvil = new Anvil({ apiKey });

const CAST_EID = process.env.ANVIL_PROPOSAL_CAST_EID ?? "u4xqZ9ENuvGyfq4qo5eT";
const SIG_FIELD = process.env.ANVIL_CLIENT_SIG_FIELD ?? "cast5ed480e05faa11f1b2e3a785f179bd1b";

const variables = {
  name: "RS Cast Packet Test",
  isTest: true,
  isDraft: false,
  files: [{ id: "proposal", castEid: CAST_EID }],
  data: {
    payloads: {
      proposal: {
        data: {
          clientInstitutionalPartnerSignerName: "James Whitfield",
          clientInstitutionalPartnerSignerTitle: "Managing Director, Direct Lending",
          rareStructureLlcSignerName: "Rare Structure LLC",
        },
      },
    },
  },
  signers: [
    {
      id: "client",
      name: "James Whitfield",
      email: "dummy@example.com",
      signerType: "embedded",
      fields: [{ fileId: "proposal", fieldId: SIG_FIELD }],
    },
  ],
};

console.log(`→ createEtchPacket against cast ${CAST_EID}  (sig field ${SIG_FIELD})`);
const { statusCode, data, errors }: any = await anvil.createEtchPacket({ variables });
if (errors) {
  console.error(`✗ failed (HTTP ${statusCode}):`);
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
const packet = data?.data?.createEtchPacket ?? data?.createEtchPacket;
const signer = packet?.documentGroup?.signers?.[0];
console.log("\n── cast packet OK ──");
console.log("HTTP            :", statusCode);
console.log("EtchPacket eid  :", packet?.eid);
console.log("DocGroup status :", packet?.documentGroup?.status);
console.log("signerEid       :", signer?.eid);
console.log("signer status   :", signer?.status);

// Confirm the generateEtchSignUrl response shape for the /sign-url endpoint.
const signerEid = signer?.eid;
if (signerEid) {
  console.log("\n→ generateEtchSignUrl");
  const signRes: any = await anvil.generateEtchSignUrl({
    variables: { signerEid, clientUserId: "rs-test-user" },
  });
  console.log("response keys   :", Object.keys(signRes));
  console.log("statusCode      :", signRes.statusCode);
  console.log("url             :", signRes.url ?? signRes?.data?.data?.generateEtchSignUrl ?? "(not at .url)");
  if (signRes.errors) console.log("errors          :", JSON.stringify(signRes.errors));
}
