/**
 * award-profile broker — proxies authenticated requests to the core-x
 * catalyst_api (Gen-3 read API): domain → US federal award profile.
 *
 * Trust model (two hops, distinct credentials):
 *   1. platform-app sends the user's Supabase access_token; `requireUser`
 *      validates it here (end-user identity / app-level auth).
 *   2. The BFF then calls core-x with the INTERNAL operator service token
 *      (`COREX_SERVICE_TOKEN`) as Bearer — the user's JWT is NOT forwarded.
 *      core-x runs on the project's private network and is never exposed to the
 *      public web; the BFF is its only caller.
 *
 * Routes:
 *   GET /:domain             → core-x GET /api/v1/award-profile/:domain
 *   GET /:domain?awards=N     → core-x …?awards=N (opt-in prime award line items)
 *
 * core-x response status + body (the `{ data }` envelope, error bodies) pass
 * through verbatim. The BFF synthesizes nothing.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { type AuthVariables, requireUser } from "../auth.ts";
import { env } from "../env.ts";

export const awardProfileRoutes = new Hono<{ Variables: AuthVariables }>();

awardProfileRoutes.use("*", requireUser);

awardProfileRoutes.get("/:domain", async (c) => {
  const domain = c.req.param("domain");
  if (!domain) {
    throw new HTTPException(400, { message: "Missing domain" });
  }
  // Pass the opt-in `awards` detail flag through; ignore everything else.
  const awards = c.req.query("awards");
  const qs = awards ? `?awards=${encodeURIComponent(awards)}` : "";
  const url = `${env.COREX_API_URL}/api/v1/award-profile/${encodeURIComponent(domain)}${qs}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.COREX_SERVICE_TOKEN}` },
  });
  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(body, { status: res.status, headers: { "content-type": contentType } });
});
