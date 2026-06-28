/**
 * Settings → Proposal Templates (`/app/settings/proposal-templates`).
 *
 * Category surface for the proposal-template tools: browse the register of authored
 * templates, or author a new one. The register and the markdown editor live one
 * level deeper under `/app/settings/templates/*`.
 */
import { FileCog, FilePlus2 } from "lucide-react";

import { Grid } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, HubCard } from "@/app/cockpit";

export default function SettingsProposalTemplates() {
  return (
    <CockpitPage
      title="Proposal Templates"
      description="Author and manage the proposal templates used to generate engagement proposals."
    >
      <BackLink to="/app/settings" label="Settings" />
      <Grid cols={1} mdCols={2} gap="4">
        <HubCard
          icon={FileCog}
          title="Proposal Templates"
          description="Browse the register of every authored template — drafts and published — and open one to edit."
          cta="Open register"
          to="/app/settings/templates"
        />
        <HubCard
          icon={FilePlus2}
          tone="accent"
          title="New Template"
          description="Author a new proposal body in markdown, preview it as a sealed PDF, and publish it to the intake picker."
          cta="Start authoring"
          to="/app/settings/templates/new"
        />
      </Grid>
    </CockpitPage>
  );
}
