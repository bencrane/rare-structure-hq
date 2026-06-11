/**
 * Operator settings — the Settings tab's persistence.
 *
 *   GET /api/v1/settings   → { data: OperatorSettings }   (the default view when no row exists yet)
 *   PUT /api/v1/settings   → upsert { renderMode }         → { data: OperatorSettings }
 *
 * Stored in `public.operator_settings`, keyed by the validated JWT `sub`. The table is reachable
 * only via the BFF's service-role client (RLS-locked, no anon/authenticated grants).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  DEFAULT_RENDER_MODE,
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
    .select("render_mode")
    .eq("auth_user_id", user.user_id)
    .maybeSingle();
  if (error) throw new HTTPException(502, { message: `settings read failed: ${error.message}` });
  const settings: OperatorSettings = {
    renderMode: (data?.render_mode as RenderMode | undefined) ?? DEFAULT_RENDER_MODE,
  };
  return c.json({ data: settings });
});

settingsRoutes.put("/", requireUser, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { renderMode?: unknown } | null;
  const renderMode = body?.renderMode;
  if (typeof renderMode !== "string" || !RENDER_MODES.includes(renderMode as RenderMode)) {
    throw new HTTPException(400, {
      message: `renderMode must be one of: ${RENDER_MODES.join(", ")}`,
    });
  }
  const { error } = await db()
    .from("operator_settings")
    .upsert(
      { auth_user_id: user.user_id, render_mode: renderMode, updated_at: new Date().toISOString() },
      { onConflict: "auth_user_id" },
    );
  if (error) throw new HTTPException(502, { message: `settings write failed: ${error.message}` });
  const settings: OperatorSettings = { renderMode: renderMode as RenderMode };
  return c.json({ data: settings });
});
