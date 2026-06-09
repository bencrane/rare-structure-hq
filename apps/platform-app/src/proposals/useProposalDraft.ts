/**
 * useProposalDraft — the operator's local draft state for a proposal (`/p/:ref`, operator view).
 *
 * PROTOTYPE: nothing here is wired to the backend yet. The operator's edited term values, drawn
 * signature, and lifecycle live in localStorage keyed by ref, so the draft survives reloads and
 * feels real. On `submit()` it transitions draft → submitted → ready, simulating the round-trip to
 * DocRaptor/Documenso ("we heard back, the sealed PDF is done") with a short timer. When the real
 * pipeline is wired, `submit()` becomes the call that pushes overrides + signature and renders, and
 * `status: "ready"` is driven by the Documenso webhook instead of a timer.
 */
import { useCallback, useEffect, useState } from "react";

export type DraftStatus = "draft" | "submitted" | "ready";

export interface ProposalDraft {
  /** Term-value overrides, keyed by headline-row label (e.g. "Infrastructure Fee" → "$30,000 / month"). */
  overrides: Record<string, string>;
  /** Drawn originator signature, as a PNG data URL. */
  signature: string | null;
  signedAt: string | null;
  status: DraftStatus;
}

const EMPTY: ProposalDraft = { overrides: {}, signature: null, signedAt: null, status: "draft" };
const keyFor = (ref: string) => `rs.draft.${ref}`;

// Simulated render latency — the beat between "confirm" and "the PDF is sealed".
const RENDER_MS = 4200;

function load(ref: string): ProposalDraft {
  try {
    const raw = window.localStorage.getItem(keyFor(ref));
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<ProposalDraft>) };
  } catch {
    return EMPTY;
  }
}

export function useProposalDraft(ref: string) {
  const [draft, setDraft] = useState<ProposalDraft>(() => load(ref));

  // Persist every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(ref), JSON.stringify(draft));
    } catch {
      // storage unavailable (private mode / quota) — the draft simply won't persist.
    }
  }, [ref, draft]);

  // Simulate hearing back from the render pipeline: submitted → ready after a beat.
  useEffect(() => {
    if (draft.status !== "submitted") return;
    const t = setTimeout(
      () => setDraft((d) => (d.status === "submitted" ? { ...d, status: "ready" } : d)),
      RENDER_MS,
    );
    return () => clearTimeout(t);
  }, [draft.status]);

  const setOverride = useCallback(
    (label: string, value: string) =>
      setDraft((d) => ({ ...d, overrides: { ...d.overrides, [label]: value } })),
    [],
  );

  const setSignature = useCallback(
    (signature: string) =>
      setDraft((d) => ({ ...d, signature, signedAt: new Date().toISOString() })),
    [],
  );

  const clearSignature = useCallback(
    () => setDraft((d) => ({ ...d, signature: null, signedAt: null })),
    [],
  );

  const submit = useCallback(
    () => setDraft((d) => (d.status === "draft" ? { ...d, status: "submitted" } : d)),
    [],
  );

  const reset = useCallback(() => setDraft(EMPTY), []);

  return { draft, setOverride, setSignature, clearSignature, submit, reset };
}
