// lander — access.governmentcontracted.com
//
// Serves per-prospect private-memorandum pages minted by scripts/mint.ts.
// Pages and media live on R2 under LANDER_PREFIX (default "landers/") in
// LANDER_BUCKET (default "data-sink"); the R2 object key IS the token
// registry — revocation = deleting the page object. No database.
//
// Modes:
//   R2 (default)  — requires R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
//   local dev     — set LANDER_LOCAL_DIR to serve pages/media from a directory
//                   (views append to $LANDER_LOCAL_DIR/views.log)
import { Hono } from "hono";
import { S3Client } from "bun";

const PORT = Number(process.env.PORT ?? 8090);
const LOCAL_DIR = process.env.LANDER_LOCAL_DIR;
const BUCKET = process.env.LANDER_BUCKET ?? "data-sink";
const PREFIX = process.env.LANDER_PREFIX ?? "landers/";

let s3: S3Client | null = null;
if (!LOCAL_DIR) {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error(
      "lander: R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are required (or set LANDER_LOCAL_DIR for local dev)",
    );
    process.exit(1);
  }
  s3 = new S3Client({
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: BUCKET,
  });
}

const TOKEN_RE = /^[a-f0-9]{24,64}$/;
const MEDIA_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const EVENTS = new Set(["open", "play", "p25", "p50", "p75", "end"]);
const MEDIA_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  vtt: "text/vtt",
};

// ── page cache ──────────────────────────────────────────────────────────
const PAGE_TTL_MS = 5 * 60_000;
const pageCache = new Map<string, { html: string; at: number }>();

async function loadPage(token: string): Promise<string | null> {
  if (LOCAL_DIR) {
    const f = Bun.file(`${LOCAL_DIR}/pages/${token}.html`);
    return (await f.exists()) ? f.text() : null;
  }
  try {
    return await s3!.file(`${PREFIX}pages/${token}.html`).text();
  } catch {
    return null;
  }
}

// ── beacon rate limit (per IP, in-process; single-instance service) ─────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const rate = new Map<string, { n: number; at: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const r = rate.get(ip);
  if (!r || now - r.at > RATE_WINDOW_MS) {
    rate.set(ip, { n: 1, at: now });
    if (rate.size > 10_000) rate.clear();
    return false;
  }
  r.n += 1;
  return r.n > RATE_MAX;
}

function hash12(input: string): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(input);
  return h.digest("hex").slice(0, 12);
}

const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Unavailable</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:oklch(0.966 0.006 90);color:oklch(0.225 0.035 262);font-family:Georgia,serif}p{font-size:17px;letter-spacing:.01em}</style></head><body><p>This document is unavailable.</p></body></html>`;

const app = new Hono();

app.get("/healthz", (c) =>
  c.json({ ok: true, mode: LOCAL_DIR ? "local" : "r2" }),
);

app.get("/x/:token", async (c) => {
  const token = c.req.param("token");
  if (!TOKEN_RE.test(token)) return c.html(NOT_FOUND_HTML, 404);
  const cached = pageCache.get(token);
  let html = cached && Date.now() - cached.at < PAGE_TTL_MS ? cached.html : null;
  if (!html) {
    html = await loadPage(token);
    if (html) pageCache.set(token, { html, at: Date.now() });
  }
  if (!html) return c.html(NOT_FOUND_HTML, 404);
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "private, no-store");
  return c.html(html);
});

app.post("/v/:token", async (c) => {
  const token = c.req.param("token");
  if (!TOKEN_RE.test(token)) return c.body(null, 204);
  const ip = (c.req.header("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return c.body(null, 429);
  let e = "open";
  try {
    const body = await c.req.json();
    if (typeof body?.e === "string" && EVENTS.has(body.e)) e = body.e;
  } catch {
    // sendBeacon without JSON body — count as open
  }
  const row = {
    token,
    e,
    at: new Date().toISOString(),
    ua: hash12(c.req.header("user-agent") ?? ""),
    ip: hash12(ip),
  };
  try {
    if (LOCAL_DIR) {
      const log = Bun.file(`${LOCAL_DIR}/views.log`);
      const prior = (await log.exists()) ? await log.text() : "";
      await Bun.write(log, prior + JSON.stringify(row) + "\n");
    } else {
      await s3!.write(
        `${PREFIX}views/${token}/${Date.now()}-${e}.json`,
        JSON.stringify(row),
        { type: "application/json" },
      );
    }
  } catch (err) {
    console.error("beacon write failed:", err);
  }
  return c.body(null, 204);
});

app.get("/m/:file", async (c) => {
  const file = c.req.param("file");
  if (!MEDIA_RE.test(file) || file.includes("..")) return c.html(NOT_FOUND_HTML, 404);
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const type = MEDIA_TYPES[ext];
  if (!type) return c.html(NOT_FOUND_HTML, 404);

  const f = LOCAL_DIR
    ? Bun.file(`${LOCAL_DIR}/media/${file}`)
    : s3!.file(`${PREFIX}media/${file}`);
  let size: number;
  try {
    size = LOCAL_DIR
      ? (await (f as ReturnType<typeof Bun.file>).exists())
        ? (f as ReturnType<typeof Bun.file>).size
        : -1
      : (await (f as ReturnType<S3Client["file"]>).stat()).size;
  } catch {
    size = -1;
  }
  if (size < 0) return c.html(NOT_FOUND_HTML, 404);

  const common = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Robots-Tag": "noindex, nofollow",
  };
  const range = c.req.header("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] !== "" || m[2] !== "")) {
    let start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    let end = m[1] !== "" && m[2] !== "" ? Number(m[2]) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    return new Response(f.slice(start, end + 1).stream(), {
      status: 206,
      headers: {
        ...common,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(f.stream(), {
    headers: { ...common, "Content-Length": String(size) },
  });
});

app.notFound((c) => c.html(NOT_FOUND_HTML, 404));

console.log(
  `lander listening on :${PORT} (${LOCAL_DIR ? `local dir ${LOCAL_DIR}` : `r2 ${BUCKET}/${PREFIX}`})`,
);

export default { port: PORT, fetch: app.fetch };
