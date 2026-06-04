/**
 * Discovery: find the "v1" Anvil cast (PDF template) and dump the castEid,
 * its signer alias ids, and its field ids — everything the /packet endpoint
 * needs to build createEtchPacket against the template.
 *   doppler run -p hq-rare-structure-hq -c prd -- bun run scripts/anvil-find-cast.ts
 */
import Anvil from "@anvilco/anvil";

const apiKey = process.env.ANVIL_API_KEY_DEV;
if (!apiKey) {
  console.error("✗ ANVIL_API_KEY_DEV missing — run via `doppler run`.");
  process.exit(1);
}
const anvil = new Anvil({ apiKey });

async function gql(query: string, variables?: Record<string, unknown>) {
  const res: any = await anvil.requestGraphQL({ query, variables }, { dataType: "json" });
  const errs = res.errors ?? res?.data?.errors;
  if (errs) {
    console.error("GraphQL errors:", JSON.stringify(errs, null, 2));
    process.exit(1);
  }
  return res?.data?.data;
}

// CAST_EID env dumps a specific cast; otherwise list all + try to find "v1".
let targetEid = process.env.CAST_EID ?? null;

const list = await gql(`query {
  currentUser { organizations { eid name casts { items { eid name title isTemplate } } } }
}`);

for (const org of list?.currentUser?.organizations ?? []) {
  console.log(`org: ${org.name} (${org.eid})`);
  for (const c of org.casts?.items ?? []) {
    console.log(`   cast "${c.name}"  eid=${c.eid}  title=${c.title}  template=${c.isTemplate}`);
    if (!targetEid && (String(c.name).toLowerCase() === "v1" || String(c.title).toLowerCase() === "v1"))
      targetEid = c.eid;
  }
}

if (!targetEid) {
  console.log('\n⚠ no cast named "v1" — pass CAST_EID=<eid> to dump a specific one.');
  process.exit(0);
}

const d = await gql(
  `query C($eid: String!) {
     cast(eid: $eid) { eid name title isTemplate allowedAliasIds exampleData config }
   }`,
  { eid: targetEid },
);
const cast = d.cast;
console.log("\n══════ v1 cast detail ══════");
console.log("castEid          :", cast.eid);
console.log("allowedAliasIds  :", JSON.stringify(cast.allowedAliasIds));
console.log("exampleData keys :", JSON.stringify(Object.keys(cast.exampleData ?? {})));
// config holds the detected field definitions (id, type, page, rect).
const fields = cast.config?.fields ?? [];
console.log(`config.fields    : ${fields.length} fields`);
for (const f of fields) {
  console.log(`  ${String(f.type).padEnd(12)} id=${f.id}  name=${JSON.stringify(f.name)}  page=${f.pageNum}`);
}
console.log("signature fields :", JSON.stringify(fields.filter((f: any) => f.type === "signature").map((f: any) => f.id)));
