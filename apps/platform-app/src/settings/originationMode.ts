/**
 * Origination-mode setting client + hook.
 *
 * Reads/writes the operator's `renderMode` via the BFF (`/api/v1/settings`), persisted in
 * `public.operator_settings`. The Settings tab toggles it; edge_api branches on it at originate.
 * Skips the call under the DEV mock session (whose "dev" token the BFF can't verify).
 */
import { useCallback, useEffect, useState } from "react";

import type { OperatorSettings, RenderMode } from "@rare-structure-hq/shared";

import { useAuth } from "@/lib/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function getSettings(token: string): Promise<OperatorSettings> {
  const res = await fetch(`${API_BASE}/api/v1/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`settings load failed: ${res.status}`);
  return (await res.json()).data as OperatorSettings;
}

async function putRenderMode(token: string, renderMode: RenderMode): Promise<OperatorSettings> {
  const res = await fetch(`${API_BASE}/api/v1/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ renderMode }),
  });
  if (!res.ok) throw new Error(`settings save failed: ${res.status}`);
  return (await res.json()).data as OperatorSettings;
}

export interface OriginationModeState {
  /** Current mode, or `null` until loaded (and under the DEV mock session). */
  renderMode: RenderMode | null;
  saving: boolean;
  error: string | null;
  choose: (mode: RenderMode) => void;
}

export function useOriginationMode(): OriginationModeState {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [renderMode, setRenderMode] = useState<RenderMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token === "dev") {
      setRenderMode(null);
      return;
    }
    let active = true;
    getSettings(token)
      .then((s) => {
        if (active) setRenderMode(s.renderMode);
      })
      .catch(() => {
        if (active) setError("Could not load the setting.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const choose = useCallback(
    (mode: RenderMode) => {
      if (!token || token === "dev" || saving || mode === renderMode) return;
      setSaving(true);
      setError(null);
      const prev = renderMode;
      setRenderMode(mode); // optimistic
      putRenderMode(token, mode)
        .then((s) => setRenderMode(s.renderMode))
        .catch(() => {
          setRenderMode(prev);
          setError("Could not save the change.");
        })
        .finally(() => setSaving(false));
    },
    [token, saving, renderMode],
  );

  return { renderMode, saving, error, choose };
}
