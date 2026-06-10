/**
 * useProposalDraft — the operator's mandate-editor state for a proposal at `/app/m/:ref`.
 *
 * Holds the STRUCTURED pricing the operator locks in (seeded from the shell, edited or not), the
 * cosmetic on-page signature (a local gate — it binds nothing; the real originator counter-signature
 * is Documenso's), and the originate lifecycle. `submit(token)` is the real call: it STAMPS the
 * locked-in values onto the instance (BFF → edge_api), which renders the PDF + creates the signing
 * envelope. "ready" is driven by the real provisioning result — not a timer — so it reflects the
 * actual Documenso envelope (and thus the prospect page's "Proceed to Proposal").
 *
 * Persisted to localStorage keyed by ref: only the EDITABLE bits (pricing + signature) survive a
 * reload; the lifecycle is session-transient and re-derived from the shell.
 */
import { useCallback, useEffect, useState } from "react";

import type { ProposalPricing } from "@rare-structure-hq/shared";

import { AlreadyOriginatedError, confirmProposal } from "./api";

export type DraftStatus = "draft" | "submitting" | "ready" | "error";

export interface ProposalDraft {
  /** Structured pricing the operator locks in — seeded from the shell, sent on Confirm. */
  pricing: ProposalPricing;
  /** Cosmetic on-page signature (PNG data URL) — a local gate, never sent to the backend. */
  signature: string | null;
  signedAt: string | null;
  status: DraftStatus;
  /** Documenso signing token returned by Confirm (envelope created). */
  signingToken: string | null;
  error: string | null;
}

type Persisted = Pick<ProposalDraft, "pricing" | "signature" | "signedAt">;
const keyFor = (ref: string) => `rs.draft.${ref}`;

function loadPersisted(ref: string): Partial<Persisted> {
  try {
    const raw = window.localStorage.getItem(keyFor(ref));
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

export function useProposalDraft(
  ref: string,
  seed: { pricing: ProposalPricing; originated: boolean },
) {
  const [draft, setDraft] = useState<ProposalDraft>(() => {
    const p = loadPersisted(ref);
    return {
      pricing: p.pricing ?? seed.pricing,
      signature: p.signature ?? null,
      signedAt: p.signedAt ?? null,
      // Already-originated proposals open in their terminal "ready" state (no re-edit / re-confirm).
      status: seed.originated ? "ready" : "draft",
      signingToken: null,
      error: null,
    };
  });

  // Persist only the editable bits — the lifecycle is transient (re-derived from the shell on load).
  useEffect(() => {
    try {
      window.localStorage.setItem(
        keyFor(ref),
        JSON.stringify({
          pricing: draft.pricing,
          signature: draft.signature,
          signedAt: draft.signedAt,
        } satisfies Persisted),
      );
    } catch {
      // storage unavailable (private mode / quota) — edits simply won't survive a reload.
    }
  }, [ref, draft.pricing, draft.signature, draft.signedAt]);

  const setPricing = useCallback(
    (next: (p: ProposalPricing) => ProposalPricing) =>
      setDraft((d) => ({ ...d, pricing: next(d.pricing) })),
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

  // Confirm & originate — STAMP the locked-in values, render the PDF, create the envelope.
  const submit = useCallback(
    async (token: string) => {
      if (draft.pricing.monthlyFeeCents <= 0) {
        setDraft((d) => ({
          ...d,
          status: "error",
          error: "Set a monthly fee before originating.",
        }));
        return;
      }
      setDraft((d) => ({ ...d, status: "submitting", error: null }));
      try {
        const res = await confirmProposal(token, ref, {
          monthlyFeeCents: draft.pricing.monthlyFeeCents,
          durationMonths: draft.pricing.durationMonths,
          billingCadence: draft.pricing.billingCadence,
          successFeeTiers: draft.pricing.successFeeTiers,
        });
        if (res.provisioned) {
          setDraft((d) => ({ ...d, status: "ready", signingToken: res.signingToken ?? null }));
        } else {
          setDraft((d) => ({
            ...d,
            status: "error",
            error: res.provisionError ?? "Could not render the agreement — retry.",
          }));
        }
      } catch (e) {
        // Already originated → terminal "ready" (the envelope + link exist); never a retry-able
        // error. The prospect page re-fetches the shell to pick up the live signing token.
        if (e instanceof AlreadyOriginatedError) {
          setDraft((d) => ({ ...d, status: "ready" }));
          return;
        }
        setDraft((d) => ({
          ...d,
          status: "error",
          error: e instanceof Error ? e.message : "Could not originate the mandate",
        }));
      }
    },
    [ref, draft.pricing],
  );

  return { draft, setPricing, setSignature, clearSignature, submit };
}
