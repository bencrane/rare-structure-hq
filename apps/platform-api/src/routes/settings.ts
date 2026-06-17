/**
 * Operator settings — the Settings tab's persistence.
 *
 *   GET /api/v1/settings   → { data: OperatorSettings }
 *   PUT /api/v1/settings   → upsert { renderMode?, directToDocumensoLane?, stripeMode? } → { data: OperatorSettings }
 *
 * DUMB PASS-THROUGH to edge_api's operator-settings gateway (service-token). The BFF validates the
 * operator's Supabase session (requireUser), asserts the validated JWT `sub` as the auth_user_id on
 * the edge path, and forwards — it NO LONGER touches public.operator_settings directly. edge_api owns
 * the table; this is consistent with the rest of the wiring (platform-app → platform-api → edge_api).
 *
 * Fields are snake_case on the edge wire, camelCase here, and all three are independent + optional on
 * the PUT (the gateway merges — an omitted field is preserved):
 *   - renderMode             — the originate pathway.
 *   - directToDocumensoLane  — the direct-to-documenso sub-lane (only meaningful under direct-to-documenso).
 *   - stripeMode             — document-payment test/live, augmenting the STRIPE_MODE env (null in the
 *                              DB = follow env; surfaced here as the `live` default).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  DEFAULT_RENDER_MODE,
  DEFAULT_STRIPE_MODE,
  DIRECT_TO_DOCUMENSO_LANES,
  type DirectToDocumensoLane,
  type OperatorSettings,
  RENDER_MODES,
  type RenderMode,
  STRIPE_MODES,
  type StripeMode,
} from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeGetOperatorSettings, edgePutOperatorSettings } from "../lib/edge.ts";

export const settingsRoutes = new Hono<{ Variables: AuthVariables }>();

// Map the edge gateway's snake_case row → the cockpit's camelCase shape, defaulting any
// unrecognized/absent value (the gateway returns stripe_mode=null when unset → `live` here).
function toOperatorSettings(e: {
  render_mode: string;
  direct_to_documenso_lane: string;
  stripe_mode: string | null;
}): OperatorSettings {
  return {
    renderMode: RENDER_MODES.includes(e.render_mode as RenderMode)
      ? (e.render_mode as RenderMode)
      : DEFAULT_RENDER_MODE,
    directToDocumensoLane: DIRECT_TO_DOCUMENSO_LANES.includes(
      e.direct_to_documenso_lane as DirectToDocumensoLane,
    )
      ? (e.direct_to_documenso_lane as DirectToDocumensoLane)
      : DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
    stripeMode:
      e.stripe_mode && STRIPE_MODES.includes(e.stripe_mode as StripeMode)
        ? (e.stripe_mode as StripeMode)
        : DEFAULT_STRIPE_MODE,
  };
}

settingsRoutes.get("/", requireUser, async (c) => {
  const user = c.get("user");
  try {
    const edge = await edgeGetOperatorSettings(user.user_id);
    return c.json({ data: toOperatorSettings(edge) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

settingsRoutes.put("/", requireUser, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    renderMode?: unknown;
    directToDocumensoLane?: unknown;
    stripeMode?: unknown;
  } | null;

  // Validate-if-present (clean 400 on a bad enum) and forward only the supplied fields; the gateway
  // merges, so an omitted field preserves its stored value.
  const edgeBody: {
    render_mode?: string;
    direct_to_documenso_lane?: string;
    stripe_mode?: string;
  } = {};

  if (body?.renderMode !== undefined) {
    if (typeof body.renderMode !== "string" || !RENDER_MODES.includes(body.renderMode as RenderMode)) {
      throw new HTTPException(400, { message: `renderMode must be one of: ${RENDER_MODES.join(", ")}` });
    }
    edgeBody.render_mode = body.renderMode;
  }
  if (body?.directToDocumensoLane !== undefined) {
    if (
      typeof body.directToDocumensoLane !== "string" ||
      !DIRECT_TO_DOCUMENSO_LANES.includes(body.directToDocumensoLane as DirectToDocumensoLane)
    ) {
      throw new HTTPException(400, {
        message: `directToDocumensoLane must be one of: ${DIRECT_TO_DOCUMENSO_LANES.join(", ")}`,
      });
    }
    edgeBody.direct_to_documenso_lane = body.directToDocumensoLane;
  }
  if (body?.stripeMode !== undefined) {
    if (typeof body.stripeMode !== "string" || !STRIPE_MODES.includes(body.stripeMode as StripeMode)) {
      throw new HTTPException(400, { message: `stripeMode must be one of: ${STRIPE_MODES.join(", ")}` });
    }
    edgeBody.stripe_mode = body.stripeMode;
  }

  try {
    const edge = await edgePutOperatorSettings(user.user_id, edgeBody);
    return c.json({ data: toOperatorSettings(edge) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
