/**
 * award-profile broker — proxies authenticated requests to the core-x
 * catalyst_api (Gen-3 read API). Replaces the deprecated data-engine-x broker.
 *
 * Trust model (two hops, distinct credentials):
 *   1. platform-app sends the user's Supabase access_token; `requireUser`
 *      validates it here (end-user identity / app-level auth).
 *   2. The BFF then calls core-x with the INTERNAL operator service token
 *      (`COREX_SERVICE_TOKEN`) as Bearer — the user's JWT is NOT forwarded.
 *      core-x is not exposed to the public web; the BFF is its only caller.
 *
 * Routes:
 *   GET /:domain            → core-x GET /api/v1/award-profile/:domain
 *   GET /:domain?awards=N    → core-x …?awards=N (opt-in prime award line items)
 *
 * core-x response status + body are passed through verbatim (including the
 * `{ data }` envelope and error bodies). The BFF synthesizes nothing.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { env } from "../env.ts";
import { requireUser, type AuthVariables } from "../auth.ts";

export const awardProfileRoutes = new Hono<{ Variables: AuthVariables }>();

awardProfileRoutes.use("*", requireUser);

async function forwardJson(upstreamUrl: string, init: RequestInit) {
  const res = await fetch(upstreamUrl, init);
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return { status: res.status, body: text, contentType };
}

awardProfileRoutes.get("/:domain", async (c) => {
  const domain = c.req.param("domain");
  if (!domain) {
    throw new HTTPException(400, { message: "Missing domain" });
  }
  // Pass the opt-in `awards` detail flag through; ignore everything else.
  const awards = c.req.query("awards");
  const qs = awards ? `?awards=${encodeURIComponent(awards)}` : "";
  const url = `${env.COREX_API_URL}/api/v1/award-profile/${encodeURIComponent(domain)}${qs}`;

  const { status, body, contentType } = await forwardJson(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}` },
  });
  return new Response(body, { status, headers: { "content-type": contentType } });
});
