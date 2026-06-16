/**
 * Operator settings — the Settings tab's persistence.
 *
 *   GET /api/v1/settings   → { data: OperatorSettings }                       (the default view when no row exists yet)
 *   PUT /api/v1/settings   → upsert { renderMode, directToDocumensoLane }     → { data: OperatorSettings }
 *
 * Stored in `public.operator_settings`, keyed by the validated JWT `sub`. The table is reachable
 * only via the BFF's service-role client (RLS-locked, no anon/authenticated grants).
 *
 * `directToDocumensoLane` is a SECOND, INDEPENDENT setting that only applies when
 * `renderMode === 'direct-to-documenso'` — it picks the direct-to-documenso lane ('envelope-distribute'
 * vs 'template-prefill-draft'). It is always persisted (the column is NOT NULL), but the SPA only
 * surfaces it under direct-to-documenso.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  DEFAULT_RENDER_MODE,
  DIRECT_TO_DOCUMENSO_LANES,
  type DirectToDocumensoLane,
  type OperatorSettings,
  RENDER_MODES,
  type RenderMode,
} from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { db } from "../lib/db.ts";

export const settingsRoutes = new Hono<{ Variables: AuthVariables }>();

settingsRoutes.get("/", requireUser, async (c) => {
  const user = c.get("user");
  const { data, error } = await db()
    .from("operator_settings")
    .select("render_mode, direct_to_documenso_lane")
    .eq("auth_user_id", user.user_id)
    .maybeSingle();
  if (error) throw new HTTPException(502, { message: `settings read failed: ${error.message}` });
  const settings: OperatorSettings = {
    renderMode: (data?.render_mode as RenderMode | undefined) ?? DEFAULT_RENDER_MODE,
    directToDocumensoLane:
      (data?.direct_to_documenso_lane as DirectToDocumensoLane | undefined) ??
      DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  };
  return c.json({ data: settings });
});

settingsRoutes.put("/", requireUser, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    renderMode?: unknown;
    directToDocumensoLane?: unknown;
  } | null;
  const renderMode = body?.renderMode;
  if (typeof renderMode !== "string" || !RENDER_MODES.includes(renderMode as RenderMode)) {
    throw new HTTPException(400, {
      message: `renderMode must be one of: ${RENDER_MODES.join(", ")}`,
    });
  }
  // The sub-lane is OPTIONAL on the PUT: when present it is validated + persisted; when omitted the
  // existing stored value is preserved (a client that only knows renderMode never clobbers it).
  const laneRaw = body?.directToDocumensoLane;
  let directToDocumensoLane: DirectToDocumensoLane | undefined;
  if (laneRaw !== undefined) {
    if (
      typeof laneRaw !== "string" ||
      !DIRECT_TO_DOCUMENSO_LANES.includes(laneRaw as DirectToDocumensoLane)
    ) {
      throw new HTTPException(400, {
        message: `directToDocumensoLane must be one of: ${DIRECT_TO_DOCUMENSO_LANES.join(", ")}`,
      });
    }
    directToDocumensoLane = laneRaw as DirectToDocumensoLane;
  }

  const row: {
    auth_user_id: string;
    render_mode: RenderMode;
    direct_to_documenso_lane?: DirectToDocumensoLane;
    updated_at: string;
  } = {
    auth_user_id: user.user_id,
    render_mode: renderMode as RenderMode,
    updated_at: new Date().toISOString(),
  };
  if (directToDocumensoLane !== undefined) row.direct_to_documenso_lane = directToDocumensoLane;

  const { data, error } = await db()
    .from("operator_settings")
    .upsert(row, { onConflict: "auth_user_id" })
    .select("render_mode, direct_to_documenso_lane")
    .single();
  if (error) throw new HTTPException(502, { message: `settings write failed: ${error.message}` });
  const settings: OperatorSettings = {
    renderMode: (data?.render_mode as RenderMode | undefined) ?? (renderMode as RenderMode),
    directToDocumensoLane:
      (data?.direct_to_documenso_lane as DirectToDocumensoLane | undefined) ??
      DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  };
  return c.json({ data: settings });
});
