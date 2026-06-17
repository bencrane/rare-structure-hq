/**
 * Origination-mode setting client + hook.
 *
 * Reads/writes the operator's `renderMode`, the `directToDocumensoLane` sub-lane, AND the
 * document-payment `stripeMode` via the BFF (`/api/v1/settings` → edge_api → `public.operator_settings`).
 * The Settings tab toggles them; edge_api branches on `renderMode` at originate, on
 * `directToDocumensoLane` (which endpoint "Confirm & Originate" calls) when
 * `renderMode === 'direct-to-documenso'`, and on `stripeMode` at document-payment mint.
 * Skips the call under the DEV mock session (whose "dev" token the BFF can't verify).
 */
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
  DEFAULT_STRIPE_MODE,
  type DirectToDocumensoLane,
  type OperatorSettings,
  type RenderMode,
  type StripeMode,
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
  body: {
    renderMode: RenderMode;
    directToDocumensoLane: DirectToDocumensoLane;
    stripeMode: StripeMode;
  },
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
  /** Persisted document-payment Stripe mode, or `null` until loaded. */
  stripeMode: StripeMode | null;
  /** The staged Stripe-mode selection — mirrors `stripeMode` until the operator picks one. */
  selectedStripeMode: StripeMode | null;
  /** Any staged selection differs from its persisted value → there is an unsaved change. */
  dirty: boolean;
  saving: boolean;
  /** True after a successful save until the next selection — drives the "Saved" confirmation. */
  saved: boolean;
  error: string | null;
  /** Stage a mode selection locally (no network). */
  select: (mode: RenderMode) => void;
  /** Stage a sub-lane selection locally (no network). */
  selectLane: (lane: DirectToDocumensoLane) => void;
  /** Stage a Stripe-mode selection locally (no network). */
  selectStripeMode: (mode: StripeMode) => void;
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
  const [stripeMode, setStripeMode] = useState<StripeMode | null>(null);
  const [selectedStripeMode, setSelectedStripeMode] = useState<StripeMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token === "dev") {
      setRenderMode(null);
      setSelected(null);
      setLane(null);
      setSelectedLane(null);
      setStripeMode(null);
      setSelectedStripeMode(null);
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
        const resolvedStripe = s.stripeMode ?? DEFAULT_STRIPE_MODE;
        setStripeMode(resolvedStripe);
        setSelectedStripeMode(resolvedStripe);
      })
      .catch(() => {
        if (active) setError("Could not load the setting.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Stage choices — local only, no write. Each clears any prior save/error state.
  const select = useCallback((mode: RenderMode) => {
    setSelected(mode);
    setSaved(false);
    setError(null);
  }, []);

  const selectLane = useCallback((nextLane: DirectToDocumensoLane) => {
    setSelectedLane(nextLane);
    setSaved(false);
    setError(null);
  }, []);

  const selectStripeMode = useCallback((mode: StripeMode) => {
    setSelectedStripeMode(mode);
    setSaved(false);
    setError(null);
  }, []);

  const dirty =
    (selected !== null && selected !== renderMode) ||
    (selectedLane !== null && selectedLane !== lane) ||
    (selectedStripeMode !== null && selectedStripeMode !== stripeMode);

  // Commit the staged selections in one PUT. No-op when there is nothing to save or a write is in flight.
  const save = useCallback(() => {
    if (!token || token === "dev" || saving || selected === null || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    putSettings(token, {
      renderMode: selected,
      directToDocumensoLane: selectedLane ?? lane ?? DEFAULT_DIRECT_TO_DOCUMENSO_LANE,
      stripeMode: selectedStripeMode ?? stripeMode ?? DEFAULT_STRIPE_MODE,
    })
      .then((s) => {
        setRenderMode(s.renderMode);
        setSelected(s.renderMode);
        const resolvedLane = s.directToDocumensoLane ?? DEFAULT_DIRECT_TO_DOCUMENSO_LANE;
        setLane(resolvedLane);
        setSelectedLane(resolvedLane);
        const resolvedStripe = s.stripeMode ?? DEFAULT_STRIPE_MODE;
        setStripeMode(resolvedStripe);
        setSelectedStripeMode(resolvedStripe);
        setSaved(true);
      })
      .catch(() => setError("Could not save the change."))
      .finally(() => setSaving(false));
  }, [token, saving, selected, selectedLane, lane, selectedStripeMode, stripeMode, dirty]);

  return {
    renderMode,
    selected,
    directToDocumensoLane: lane,
    selectedLane,
    stripeMode,
    selectedStripeMode,
    dirty,
    saving,
    saved,
    error,
    select,
    selectLane,
    selectStripeMode,
    save,
  };
}
