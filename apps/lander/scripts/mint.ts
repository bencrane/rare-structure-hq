// mint.ts — bake and publish a per-prospect memorandum page.
//
// Usage (R2 creds via doppler, project hq-rare-structure-hq / prd):
//   doppler run -- bun scripts/mint.ts --uei DDWUEXGZVGA5 --media equipment-v1-ab12cd34.mp4
//   doppler run -- bun scripts/mint.ts --name "gear up" --media <key>
//   doppler run -- bun scripts/mint.ts --list
//   doppler run -- bun scripts/mint.ts --revoke <token>
//
// Local dev (no R2): add --local <dir>  → writes <dir>/pages/<token>.html
//
// Flags:
//   --fixture <path>  yard-markets.json (default: ~/Desktop/hq/data-cache/equipment/yard-markets.json)
//   --firm "Name"     override the displayed firm name
//   --media <key>     media object key under landers/media/ (required for mint)
import { S3Client } from "bun";
import { listObjects } from "./s3util.ts";

const args = process.argv.slice(2);
function flag(name: string): string | null {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}
function has(name: string): boolean {
  return args.includes(`--${name}`);
}

const BUCKET = process.env.LANDER_BUCKET ?? "data-sink";
const PREFIX = process.env.LANDER_PREFIX ?? "landers/";
const BASE_URL = process.env.LANDER_BASE_URL ?? "https://access.governmentcontracted.com";
const LOCAL = flag("local");

function s3(): S3Client {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY required (doppler run --) — or use --local <dir>");
    process.exit(1);
  }
  return new S3Client({
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: BUCKET,
  });
}

// ── list / revoke ───────────────────────────────────────────────────────
if (has("list")) {
  const client = s3();
  const res = await listObjects(client, `${PREFIX}pages/`);
  for (const o of res.contents ?? []) {
    if (!o.key.endsWith(".meta.json")) continue;
    const meta = JSON.parse(await client.file(o.key).text());
    console.log(`${meta.token}  ${meta.minted_at}  ${meta.firm}`);
  }
  process.exit(0);
}
const revoke = flag("revoke");
if (revoke) {
  const client = s3();
  await client.delete(`${PREFIX}pages/${revoke}.html`);
  await client.delete(`${PREFIX}pages/${revoke}.meta.json`).catch(() => {});
  console.log(`revoked ${revoke}`);
  process.exit(0);
}

// ── select the prospect from the fixture ────────────────────────────────
const fixturePath =
  flag("fixture") ??
  `${process.env.HOME}/Desktop/hq/data-cache/equipment/yard-markets.json`;
const fixture: Record<string, YardEntry> = JSON.parse(await Bun.file(fixturePath).text());

interface YardEntry {
  identity: { uei: string; name: string; city: string; state: string; zip5: string; domain?: string };
  geometry: { mode: string; center_zip?: string; states?: string[] };
  market: {
    active: { firms_relevant: number; dollars_relevant: number; size_bands_relevant: Record<string, number> };
    between_jobs: {
      firms_relevant: number;
      dollars_relevant_fy2526: number;
      stats: { recent_12mo_pct: number; open_vehicle_pct: number; sam_active_pct: number };
      size_bands_relevant: Record<string, number>;
    };
    universe_relevant: number;
  };
  window: { active: string; between_jobs: string };
  artifact: string;
}

const uei = flag("uei");
const nameQ = flag("name")?.toLowerCase();
let entry: YardEntry | null = null;
if (uei) {
  entry = fixture[uei] ?? null;
  if (!entry) {
    console.error(`no fixture entry for UEI ${uei}`);
    process.exit(1);
  }
} else if (nameQ) {
  const matches = Object.values(fixture).filter((e) =>
    e.identity.name.toLowerCase().includes(nameQ),
  );
  if (matches.length !== 1) {
    console.error(`--name matched ${matches.length} entries:`);
    for (const m of matches.slice(0, 20)) console.error(`  ${m.identity.uei}  ${m.identity.name}  (${m.identity.city}, ${m.identity.state})`);
    process.exit(1);
  }
  entry = matches[0];
} else {
  console.error("provide --uei or --name (or --list / --revoke)");
  process.exit(1);
}

const media = flag("media");
if (!media) {
  console.error("--media <key> required (upload first: bun scripts/media.ts <file>)");
  process.exit(1);
}

// ── bake ────────────────────────────────────────────────────────────────
const KEEP_UPPER = new Set(["LLC", "INC", "JV", "CO", "USA", "US", "II", "III", "IV", "LP", "LLP", "PC", "CORP", "LTD"]);
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (KEEP_UPPER.has(w.replace(/[.,]/g, "")) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}
function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
const BAND_ORDER = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+", "unknown"];
function bands(b: Record<string, number>, alt: boolean): string {
  const max = Math.max(1, ...Object.values(b));
  return BAND_ORDER.filter((k) => (b[k] ?? 0) > 0)
    .map((k) => {
      const n = b[k] ?? 0;
      const w = Math.max(2, Math.round((n / max) * 100));
      const label = k === "unknown" ? "undisclosed" : k;
      return `<div class="bandRow${alt ? " alt" : ""}"><div class="bl">${label}</div><div class="bar"><i style="width:${w}%"></i></div><div class="bv">${n}</div></div>`;
    })
    .join("\n        ");
}
function geoDesc(g: YardEntry["geometry"], id: YardEntry["identity"]): string {
  if (g.mode?.startsWith("radius")) {
    const mi = g.mode.match(/(\d+)mi/)?.[1] ?? "100";
    return `a ${mi}-mile radius of ${titleCase(id.city)}, ${id.state}`;
  }
  if (g.states?.length) {
    return g.states.length <= 4 ? `their declared footprint (${g.states.join(", ")})` : `their declared ${g.states.length}-state footprint`;
  }
  return "their operating footprint";
}

const id = entry.identity;
const firmTitle = flag("firm") ?? titleCase(id.name);
const firmShort = firmTitle.split(/\s+/).slice(0, 3).join(" ");
const firmPoss = `${firmShort}’${firmShort.endsWith("s") ? "" : "s"}`;
const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
const date = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

const tpl = await Bun.file(new URL("../template.html", import.meta.url).pathname).text();
const m = entry.market;
const html = tpl
  .replaceAll("{{FIRM_TITLE}}", firmTitle)
  .replaceAll("{{FIRM_SHORT}}", firmShort)
  .replaceAll("{{FIRM_POSS}}", firmPoss)
  .replaceAll("{{CITY_STATE}}", `${titleCase(id.city)}, ${id.state}`)
  .replaceAll("{{DATE}}", date)
  .replaceAll("{{REF}}", token.slice(0, 8).toUpperCase())
  .replaceAll("{{TOKEN}}", token)
  .replaceAll("{{MEDIA}}", media)
  .replaceAll("{{GEO_DESC}}", geoDesc(entry.geometry, id))
  .replaceAll("{{UNIVERSE}}", String(m.universe_relevant))
  .replaceAll("{{ACTIVE_FIRMS}}", String(m.active.firms_relevant))
  .replaceAll("{{ACTIVE_DOLLARS}}", money(m.active.dollars_relevant))
  .replaceAll("{{BETWEEN_FIRMS}}", String(m.between_jobs.firms_relevant))
  .replaceAll("{{BETWEEN_DOLLARS}}", money(m.between_jobs.dollars_relevant_fy2526))
  .replaceAll("{{SAM_PCT}}", String(m.between_jobs.stats.sam_active_pct))
  .replaceAll("{{RECENT12_PCT}}", String(m.between_jobs.stats.recent_12mo_pct))
  .replaceAll("{{VEHICLE_PCT}}", String(m.between_jobs.stats.open_vehicle_pct))
  .replaceAll("{{BANDS_ACTIVE}}", bands(m.active.size_bands_relevant, false))
  .replaceAll("{{BANDS_BETWEEN}}", bands(m.between_jobs.size_bands_relevant, true))
  .replaceAll("{{WINDOW_ACTIVE}}", entry.window.active)
  .replaceAll("{{WINDOW_BETWEEN}}", entry.window.between_jobs)
  .replaceAll("{{ARTIFACT}}", entry.artifact);

const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
if (leftover) {
  console.error(`unbaked placeholders: ${[...new Set(leftover)].join(", ")}`);
  process.exit(1);
}

const meta = {
  token,
  firm: firmTitle,
  uei: id.uei,
  vertical: "equipment",
  media,
  minted_at: new Date().toISOString(),
};

if (LOCAL) {
  await Bun.write(`${LOCAL}/pages/${token}.html`, html);
  console.log(`local: ${LOCAL}/pages/${token}.html`);
  console.log(`url:   http://localhost:8090/x/${token}`);
} else {
  const client = s3();
  await client.write(`${PREFIX}pages/${token}.html`, html, { type: "text/html" });
  await client.write(`${PREFIX}pages/${token}.meta.json`, JSON.stringify(meta), { type: "application/json" });
  console.log(`minted for ${firmTitle} (${id.uei})`);
  console.log(`${BASE_URL}/x/${token}`);
}
