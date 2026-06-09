/**
 * Dossier — the operator cockpit tab. A research-driven alternative to the bare intake form: land
 * in the prospect's profile, verify / edit the intelligence on the call, then originate — which
 * runs the same create → DocRaptor → Documenso path and materializes the executive-summary proposal.
 *
 * Parallel to the Proposals tab (not a replacement). Authors no geometry — composes CockpitPage.
 */
import { CockpitPage } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { ProspectDossierBoard } from "@/proposals/ProspectDossierBoard";

export default function Dossier() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  return (
    <CockpitPage
      title="Dossier"
      description="Pull the prospect, verify the intelligence on the call, then originate — the agreement materializes on save."
      width="wide"
    >
      <ProspectDossierBoard token={token} />
    </CockpitPage>
  );
}
