/**
 * rare-structure-hq platform-api — Hono BFF for the signed-in app.
 *
 * Responsibilities:
 * - Validate rare-structure-hq Supabase JWTs (ES256 + JWKS)
 * - /health (unauthenticated) for liveness probes
 * - /api/v1/me (auth-required) echoes the validated user
 * - /api/v1/proposals/:ref/* (public, ref-scoped) Anvil embedded e-sign
 * - /api/v1/award-profile/:domain (auth-required) brokers to core-x catalyst_api
 *
 * Deferred: Recipient profile, project matching.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { allowedOrigins, env } from "./env.ts";
import { requireUser, type AuthVariables } from "./auth.ts";
import { proposalRoutes } from "./routes/proposals.ts";
import { awardProfileRoutes } from "./routes/award-profile.ts";

const app = new Hono<{ Variables: AuthVariables & { requestId: string } }>();

app.use("*", requestId());

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({ status: "ok", app_env: env.APP_ENV, ts: new Date().toISOString() }),
);

app.get("/api/v1/me", requireUser, (c) => {
  const user = c.get("user");
  return c.json({ user_id: user.user_id, email: user.email, app_env: env.APP_ENV });
});

app.route("/api/v1/proposals", proposalRoutes);
app.route("/api/v1/award-profile", awardProfileRoutes);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
console.log(`platform-api listening on :${port} [${env.APP_ENV}]`);

serve({ fetch: app.fetch, port });
