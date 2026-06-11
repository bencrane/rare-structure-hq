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

import { MandateEditor } from "@/proposals/MandateEditor";
import { getProposalShell } from "@/proposals/api";
import { useProposalShell } from "@/proposals/useProposalShell";

export default function Mandate() {
  const { ref } = useParams<{ ref: string }>();
  const { shell, state } = useProposalShell(ref, getProposalShell);

  if (state === "loading") return <Note>Loading mandate…</Note>;
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
