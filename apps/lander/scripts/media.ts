// media.ts — upload a video (or poster) to the lander media prefix.
//
//   doppler run -- bun scripts/media.ts ~/Downloads/equipment-loom.mp4
//   doppler run -- bun scripts/media.ts <file> --key equipment-v1.mp4   # explicit key
//
// Default key gets a random 8-hex suffix so media URLs are not guessable.
import { S3Client } from "bun";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const keyIdx = args.indexOf("--key");
const explicitKey = keyIdx >= 0 ? args[keyIdx + 1] : null;

if (!file) {
  console.error("usage: bun scripts/media.ts <file> [--key name.mp4]");
  process.exit(1);
}
const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY required (doppler run --)");
  process.exit(1);
}
const BUCKET = process.env.LANDER_BUCKET ?? "data-sink";
const PREFIX = process.env.LANDER_PREFIX ?? "landers/";

const f = Bun.file(file);
if (!(await f.exists())) {
  console.error(`no such file: ${file}`);
  process.exit(1);
}
const base = file.split("/").pop()!;
const ext = base.includes(".") ? base.split(".").pop()! : "mp4";
const stem = base.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-");
const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
const key = explicitKey ?? `${stem}-${rand}.${ext}`;
const types: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", vtt: "text/vtt" };

const client = new S3Client({
  endpoint: R2_ENDPOINT,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  bucket: BUCKET,
});
await client.write(`${PREFIX}media/${key}`, f, { type: types[ext.toLowerCase()] ?? "application/octet-stream" });
console.log(`uploaded ${(f.size / 1e6).toFixed(1)}MB → ${PREFIX}media/${key}`);
console.log(`use in mint: --media ${key}`);
