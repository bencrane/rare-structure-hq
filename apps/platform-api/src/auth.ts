/**
 * Supabase JWT validation via JWKS.
 *
 * The rare-structure-hq Supabase project issues asymmetric JWTs (ES256)
 * and publishes signing keys at the JWKS endpoint. platform-app
 * attaches the session access_token as a Bearer header; this middleware
 * verifies signature + issuer + audience and stashes the user on the
 * Hono context before any handler runs.
 */

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "./env.ts";

export type CurrentUser = {
  user_id: string;
  email: string;
};

const jwks = createRemoteJWKSet(new URL(env.HQX_SUPABASE_JWKS_URL));

export type AuthVariables = {
  user: CurrentUser;
};

export const requireUser: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const authHeader = c.req.header("authorization") ?? c.req.header("Authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  const token = authHeader.slice("bearer ".length).trim();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.HQX_SUPABASE_ISSUER,
      audience: "authenticated",
    });

    const userId = payload.sub;
    if (!userId) {
      throw new HTTPException(401, { message: "Token missing sub claim" });
    }

    const email = typeof payload.email === "string" ? payload.email : "";

    c.set("user", { user_id: userId, email });
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    const detail = err instanceof Error ? err.message : "verification failed";
    throw new HTTPException(401, { message: `Invalid token: ${detail}` });
  }
};
