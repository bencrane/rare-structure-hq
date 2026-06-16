/**
 * Origination-mode setting client + hook.
 *
 * Reads/writes the operator's `renderMode` AND the `directToDocumensoLane` sub-lane via the BFF
 * (`/api/v1/settings`), persisted in `public.operator_settings`. The Settings tab toggles them;
 * edge_api branches on `renderMode` at originate, and the SPA branches on `directToDocumensoLane`
 * (which endpoint "Confirm & Originate" calls) when `renderMode === 'direct-to-documenso'`.
 * Skips the call under the DEV mock session (whose "dev" token the BFF can't verify).
 */
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  type DirectToDocumensoLane,
  type OperatorSettings,
  type RenderMode,
} from "@rare-structure-hq/shared";

import { useAuth } from "@/lib/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function getSettings(token: string): Promise<OperatorSettings> {
  const res = await fetch(`${API_BASE}/api/v1/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`settings load failed: ${res.status}`);
  return (await res.json()).data as OperatorSettings;
}

async function putSettings(
  token: string,
  body: { renderMode: RenderMode; directToDocumensoLane: DirectToDocumensoLane },
): Promise<OperatorSettings> {
  const res = await fetch(`${API_BASE}/api/v1/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`settings save failed: ${res.status}`);
  return (await res.json()).data as OperatorSettings;
}

export interface OriginationModeState {
  /** Persisted mode (server truth), or `null` until loaded (and under the DEV mock session). */
  renderMode: RenderMode | null;
  /** The staged mode selection — mirrors `renderMode` until the operator picks a different card. */
  selected: RenderMode | null;
  /** Persisted direct-to-documenso sub-lane, or `null` until loaded. */
  directToDocumensoLane: DirectToDocumensoLane | null;
  /** The staged sub-lane selection — mirrors `directToDocumensoLane` until the operator picks one. */
  selectedLane: DirectToDocumensoLane | null;
  /** `selected`/`selectedLane` differ from the persisted values → there is an unsaved change. */
  dirty: boolean;
  saving: boolean;
  /** True after a successful save until the next selection — drives the "Saved" confirmation. */
  saved: boolean;
  error: string | null;
  /** Stage a mode selection locally (no network). */
  select: (mode: RenderMode) => void;
  /** Stage a sub-lane selection locally (no network). */
  selectLane: (lane: DirectToDocumensoLane) => void;
  /** Persist the staged selections to `public.operator_settings` via the BFF. */
  save: () => void;
}

export function useOriginationMode(): OriginationModeState {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [renderMode, setRenderMode] = useState<RenderMode | null>(null);
  const [selected, setSelected] = useState<RenderMode | null>(null);
  const [lane, setLane] = useState<DirectToDocumensoLane | null>(null);
  const [selectedLane, setSelectedLane] = useState<DirectToDocumensoLane | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token === "dev") {
      setRenderMode(null);
      setSelected(null);
      setLane(null);
      setSelectedLane(null);
      return;
    }
    let active = true;
    getSettings(token)
      .then((s) => {
        if (!active) return;
        setRenderMode(s.renderMode);
        setSelected(s.renderMode);
        const resolvedLane = s.directToDocumensoLane ?? DEFAULT_DIRECT_TO_DOCUMENSO_LANE;
        setLane(resolvedLane);
        setSelectedLane(resolvedLane);
      })
      .catch(() => {
        if (active) setError("Could not load the setting.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Stage a mode choice — local only, no write. Clears any prior save/error state.
  const select = useCallback((mode: RenderMode) => {
    setSelected(mode);
    setSaved(false);
    setError(null);
  }, []);

  // Stage a sub-lane choice — local only, no write. Clears any prior save/error state.
  const selectLane = useCallback((nextLane: DirectToDocumensoLane) => {
    setSelectedLane(nextLane);
    setSaved(false);
    setError(null);
  }, []);

  const dirty =
    (selected !== null && selected !== renderMode) ||
    (selectedLane !== null && selectedLane !== lane);

  // Commit the staged selections. No-op when there is nothing to save or a write is in flight.
  const save = useCallback(() => {
    if (!token || token === "dev" || saving || selected === null || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    putSettings(token, {
      renderMode: selected,
      // The column is NOT NULL; send the staged lane (falling back to the loaded value, then the
      // default) so a save never omits it.
      directToDocumensoLane: selectedLane ?? lane ?? DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
    })
      .then((s) => {
        setRenderMode(s.renderMode);
        setSelected(s.renderMode);
        const resolvedLane = s.directToDocumensoLane ?? DEFAULT_DIRECT_TO_DOCUMENSO_LANE;
        setLane(resolvedLane);
        setSelectedLane(resolvedLane);
        setSaved(true);
      })
      .catch(() => setError("Could not save the change."))
      .finally(() => setSaving(false));
  }, [token, saving, selected, selectedLane, lane, dirty]);

  return {
    renderMode,
    selected,
    directToDocumensoLane: lane,
    selectedLane,
    dirty,
    saving,
    saved,
    error,
    select,
    selectLane,
    save,
  };
}
