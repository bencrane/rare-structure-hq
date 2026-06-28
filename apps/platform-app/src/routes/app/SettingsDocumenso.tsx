/**
 * Settings → Documenso (`/app/settings/documenso`).
 *
 * Category surface for Documenso configuration. The template editor — set default
 * field values that bake onto every document created from a template — lives under
 * `/app/settings/documenso-templates`.
 */
import { FileSignature } from "lucide-react";

import { Grid } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, HubCard } from "@/app/cockpit";

export default function SettingsDocumenso() {
  return (
    <CockpitPage
      title="Documenso"
      description="Manage Documenso templates and the default values baked onto their fields."
    >
      <BackLink to="/app/settings" label="Settings" />
      <Grid cols={1} mdCols={2} gap="4">
        <HubCard
          icon={FileSignature}
          title="Documenso Templates"
          description="Open a Documenso template and set default values on its fields. Defaults bake onto the template — every document created from it inherits them."
          cta="Open editor"
          to="/app/settings/documenso-templates"
        />
      </Grid>
    </CockpitPage>
  );
}
