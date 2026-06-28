/**
 * Settings → Engagement Templates (`/app/settings/engagement`).
 *
 * Category surface for repo-resident engagement templates. Two surfaces share the same
 * brand → path → archetype → version → style cascade:
 *   - "Create a PDF" (DocRaptor render → clean PDF) — `/app/settings/engagement-templates`.
 *   - "Create a Documenso Template" (render-push → reusable Documenso template, no fields placed) —
 *     `/app/settings/engagement-templates/documenso`.
 */
import { FileDown, FileSignature } from "lucide-react";

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
          title="Create a PDF"
          description="Render a repo-resident engagement template (brand → path → archetype → version) to a clean PDF via DocRaptor. Opens in a new tab; nothing is sent to Documenso."
          cta="Open renderer"
          to="/app/settings/engagement-templates"
        />
        <HubCard
          icon={FileSignature}
          title="Create a Documenso Template"
          description="Render the template to a PDF and create it in Documenso as a reusable template. No fields are placed — affix the Documenso fields in the editor afterward."
          cta="Open creator"
          to="/app/settings/engagement-templates/documenso"
        />
      </Grid>
    </CockpitPage>
  );
}
