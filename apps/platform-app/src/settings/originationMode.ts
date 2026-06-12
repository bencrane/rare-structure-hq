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
  /** Persisted mode (server truth), or `null` until loaded (and under the DEV mock session). */
  renderMode: RenderMode | null;
  /** The staged selection — mirrors `renderMode` until the operator picks a different card. */
  selected: RenderMode | null;
  /** `selected` differs from the persisted `renderMode` → there is an unsaved change. */
  dirty: boolean;
  saving: boolean;
  /** True after a successful save until the next selection — drives the "Saved" confirmation. */
  saved: boolean;
  error: string | null;
  /** Stage a selection locally (no network). */
  select: (mode: RenderMode) => void;
  /** Persist the staged selection to `public.operator_settings` via the BFF. */
  save: () => void;
}

export function useOriginationMode(): OriginationModeState {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [renderMode, setRenderMode] = useState<RenderMode | null>(null);
  const [selected, setSelected] = useState<RenderMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token === "dev") {
      setRenderMode(null);
      setSelected(null);
      return;
    }
    let active = true;
    getSettings(token)
      .then((s) => {
        if (!active) return;
        setRenderMode(s.renderMode);
        setSelected(s.renderMode);
      })
      .catch(() => {
        if (active) setError("Could not load the setting.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Stage a choice — local only, no write. Clears any prior save/error state.
  const select = useCallback((mode: RenderMode) => {
    setSelected(mode);
    setSaved(false);
    setError(null);
  }, []);

  // Commit the staged selection. No-op when there is nothing to save or a write is in flight.
  const save = useCallback(() => {
    if (!token || token === "dev" || saving || selected === null || selected === renderMode) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    putRenderMode(token, selected)
      .then((s) => {
        setRenderMode(s.renderMode);
        setSelected(s.renderMode);
        setSaved(true);
      })
      .catch(() => setError("Could not save the change."))
      .finally(() => setSaving(false));
  }, [token, saving, selected, renderMode]);

  const dirty = selected !== null && selected !== renderMode;

  return { renderMode, selected, dirty, saving, saved, error, select, save };
}
