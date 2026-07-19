// views.ts — read the view telemetry for a minted lander.
//
//   doppler run -- bun scripts/views.ts <token>
//   doppler run -- bun scripts/views.ts --all      # tokens with any views
import { S3Client } from "bun";
import { listObjects } from "./s3util.ts";

const args = process.argv.slice(2);
const token = args.find((a) => !a.startsWith("--"));
const all = args.includes("--all");

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY required (doppler run --)");
  process.exit(1);
}
const BUCKET = process.env.LANDER_BUCKET ?? "data-sink";
const PREFIX = process.env.LANDER_PREFIX ?? "landers/";
const client = new S3Client({
  endpoint: R2_ENDPOINT,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  bucket: BUCKET,
});

if (all) {
  const res = await listObjects(client, `${PREFIX}views/`);
  const byToken = new Map<string, number>();
  for (const o of res.contents ?? []) {
    const t = o.key.slice(`${PREFIX}views/`.length).split("/")[0];
    byToken.set(t, (byToken.get(t) ?? 0) + 1);
  }
  for (const [t, n] of byToken) console.log(`${t}  ${n} events`);
  process.exit(0);
}
if (!token) {
  console.error("usage: bun scripts/views.ts <token> | --all");
  process.exit(1);
}
const res = await listObjects(client, `${PREFIX}views/${token}/`);
const rows: Array<{ at: string; e: string; ua: string; ip: string }> = [];
for (const o of res.contents ?? []) {
  try {
    rows.push(JSON.parse(await client.file(o.key).text()));
  } catch {
    // skip malformed
  }
}
rows.sort((a, b) => a.at.localeCompare(b.at));
if (!rows.length) {
  console.log("no views recorded");
  process.exit(0);
}
for (const r of rows) console.log(`${r.at}  ${r.e.padEnd(5)}  ua:${r.ua}  ip:${r.ip}`);
const opens = rows.filter((r) => r.e === "open").length;
const plays = rows.filter((r) => r.e === "play").length;
const p75 = rows.filter((r) => r.e === "p75").length;
console.log(`\n${opens} opens · ${plays} plays · ${p75} reached 75%`);
