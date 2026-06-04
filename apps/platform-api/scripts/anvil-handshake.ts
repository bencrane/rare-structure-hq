/**
 * Anvil createEtchPacket handshake test.
 *
 * Proves the @anvilco/anvil integration end-to-end: uploads a test PDF,
 * creates an Etch packet with a single EMBEDDED signer (so Anvil sends NO
 * email), and prints the resulting signerEid + packet status.
 *
 * The API key is read from the environment and never printed. Run it with the
 * key injected by Doppler (swap the config to wherever ANVIL_API_KEY_DEV lives):
 *
 *   doppler run -p hq-rare-structure-hq -c dev -- \
 *     bun run scripts/anvil-handshake.ts
 *
 * Optional: TEST_PDF=/abs/path.pdf to override the document.
 */
import { existsSync } from "node:fs";
import Anvil from "@anvilco/anvil";

const apiKey = process.env.ANVIL_API_KEY_DEV;
if (!apiKey) {
  console.error(
    "✗ ANVIL_API_KEY_DEV is not in the environment.\n" +
      "  Inject it via Doppler, e.g.:\n" +
      "  doppler run -p hq-rare-structure-hq -c dev -- bun run scripts/anvil-handshake.ts",
  );
  process.exit(1);
}

const PDF_PATH =
  process.env.TEST_PDF ?? "/Users/benjamincrane/Downloads/strategic_origination_mandate.pdf";

if (!existsSync(PDF_PATH)) {
  console.error(`✗ Test PDF not found at: ${PDF_PATH}\n  Set TEST_PDF=/abs/path.pdf to override.`);
  process.exit(1);
}

const anvil = new Anvil({ apiKey });

// Single file + single EMBEDDED signer. A signature field is placed on page 0
// and assigned to the signer so the packet is valid to "send".
const variables = {
  name: "RS Anvil Handshake Test",
  isTest: true, // test packet — not counted against quota, nothing real is sent
  isDraft: false, // materialize the signer + signerEid (embedded → still no email)
  signers: [
    {
      id: "signer1",
      name: "Dummy Signer",
      email: "dummy@example.com", // required by Anvil even for embedded signers
      signerType: "embedded", // CRITICAL: embedded => Anvil sends no email
      fields: [{ fileId: "testPdf", fieldId: "sig1" }],
    },
  ],
  files: [
    {
      id: "testPdf",
      title: "Handshake Test Document",
      file: Anvil.prepareGraphQLFile(PDF_PATH),
      fields: [
        { id: "sig1", type: "signature", pageNum: 0, rect: { x: 100, y: 100, width: 160, height: 40 } },
      ],
    },
  ],
};

console.log(`→ createEtchPacket  (file: ${PDF_PATH})`);
const { statusCode, data, errors } = await anvil.createEtchPacket({ variables });

if (errors) {
  console.error(`✗ createEtchPacket failed (HTTP ${statusCode})`);
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}

// node-anvil returns the GraphQL `data` object; the packet may sit at
// data.createEtchPacket or data.data.createEtchPacket depending on version —
// resolve defensively and dump raw if neither matches.
const packet =
  (data as any)?.data?.createEtchPacket ?? (data as any)?.createEtchPacket ?? null;
const signer = packet?.documentGroup?.signers?.[0];

if (!packet) {
  console.error("✗ Unexpected response shape — raw data:");
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("\n── Anvil handshake OK ──────────────────────────");
console.log("HTTP status        :", statusCode);
console.log("EtchPacket eid     :", packet.eid);
console.log("EtchPacket name    :", packet.name);
console.log("DocumentGroup eid  :", packet.documentGroup?.eid);
console.log("DocumentGroup state:", packet.documentGroup?.status);
console.log("Signer eid         :", signer?.eid, "  <-- signerEid");
console.log("Signer status      :", signer?.status);
console.log("────────────────────────────────────────────────");
