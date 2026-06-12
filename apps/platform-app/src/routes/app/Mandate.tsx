/**
 * Mandate — the operator's portal view of a minted mandate at `/app/m/:ref`.
 *
 * Reached from "Originate Mandate". A NATIVE cockpit page: it renders inside the portal shell
 * (the sidebar comes from AppShell, like Dossier/Pipeline), loads the proposal by `ref`, and shows
 * the operator's editable mandate UI (`MandateEditor`) keyed to that proposal's template +
 * prospect. The pricing config the operator selected (monthly · duration · billing cadence ·
 * success-fee schedule) surfaces through the proposal's headline terms.
 *
 * Distinct from the PUBLIC client surface at `/p/:ref` — that stays the prospect's view.
 */
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

import { MandateDraftShell } from "@/proposals/MandateDraftShell";
import { MandateEditor } from "@/proposals/MandateEditor";
import { getProposalShell } from "@/proposals/api";
import { useProposalShell } from "@/proposals/useProposalShell";
import { useOriginationMode } from "@/settings/originationMode";

export default function Mandate() {
  const { ref } = useParams<{ ref: string }>();
  const { renderMode } = useOriginationMode();
  const { shell, state } = useProposalShell(ref, getProposalShell);

  // Direct-to-documenso: `ref` is an engagement_mandate_draft_content id, not a proposal. Render the
  // engagement-proposal STRUCTURE (the shared DocumentFrame chrome + section scaffold) with the data
  // slots blank — never the proposal pricing nor the "not found" error. The draft's concrete values
  // and its sign/confirm wiring land separately; this replaces the previously-blank page so the
  // shell never vanishes.
  if (renderMode === "direct-to-documenso")
    return <MandateDraftShell draftId={ref} housing="cockpit" />;

  if (state === "loading") return <Note>Loading mandate…</Note>;
  // Hold "not found" until the originate mode resolves — a draft ref must never flash it.
  if (state === "notfound" && renderMode === null) return <Note>Loading mandate…</Note>;
  if (state === "notfound" || !shell || !ref) return <Note>This mandate could not be found.</Note>;

  // `key={ref}` forces a fresh draft when moving between mandates without leaving the portal.
  // `housing="cockpit"` aligns the viewer's utility bar to the AppShell sidebar header band.
  return <MandateEditor key={ref} shell={shell} proposalRef={ref} housing="cockpit" />;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.2em]">
        {children}
      </div>
    </div>
  );
}
