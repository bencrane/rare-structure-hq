/**
 * Settings → Engagement Templates (`/app/settings/engagement`).
 *
 * Category surface for repo-resident engagement templates. The renderer
 * (path → archetype → version → clean PDF via DocRaptor) lives under
 * `/app/settings/engagement-templates`.
 */
import { FileDown } from "lucide-react";

import { Grid } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, HubCard } from "@/app/cockpit";

export default function SettingsEngagement() {
  return (
    <CockpitPage
      title="Engagement Templates"
      description="Render repo-resident engagement templates to clean PDFs via DocRaptor."
    >
      <BackLink to="/app/settings" label="Settings" />
      <Grid cols={1} mdCols={2} gap="4">
        <HubCard
          icon={FileDown}
          title="Engagement Templates"
          description="Render a repo-resident engagement template (path → archetype → version) to a clean PDF via DocRaptor. Opens in a new tab; nothing is sent to Documenso."
          cta="Open renderer"
          to="/app/settings/engagement-templates"
        />
      </Grid>
    </CockpitPage>
  );
}
