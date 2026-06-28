/**
 * Settings — the operator configuration hub.
 *
 * Pure navigation: a responsive grid of category cards, one per configuration area. Each
 * routes to its own child surface (`/app/settings/<area>`) that holds that area's
 * controls. This file owns no data and no geometry — just the entry points.
 * The card primitive (sizing, equal heights, CTA placement) lives in `@/app/cockpit`.
 */
import { FileCog, FileDown, FileOutput, FileSignature, Route } from "lucide-react";

import { Grid } from "@rare-structure-hq/ui";

import { CockpitPage, HubCard } from "@/app/cockpit";

export default function Settings() {
  return (
    <CockpitPage
      title="Settings"
      description="Configure the operator cockpit. Pick an area to manage."
    >
      <Grid cols={1} mdCols={2} gap="4">
        <HubCard
          icon={FileCog}
          title="Proposal Templates"
          description="Author and manage the proposal templates used to generate engagement proposals."
          cta="Open"
          to="/app/settings/proposal-templates"
        />
        <HubCard
          icon={Route}
          title="Origination"
          description="How “Confirm &amp; Originate” provisions the agreement — pathway, Documenso lane, and Stripe payment mode."
          cta="Open"
          to="/app/settings/origination"
        />
        <HubCard
          icon={FileSignature}
          title="Documenso"
          description="Open Documenso templates and bake default values onto their fields."
          cta="Open"
          to="/app/settings/documenso"
        />
        <HubCard
          icon={FileDown}
          title="Engagement Templates"
          description="Render repo-resident engagement templates to clean PDFs via DocRaptor."
          cta="Open"
          to="/app/settings/engagement"
        />
        <HubCard
          icon={FileOutput}
          title="Create Documenso Template via Render-Push"
          description="Compile a repo-resident template's HTML, render the PDF via DocRaptor, and create it in Documenso as a template."
          cta="Open"
          to="/app/settings/render-push"
        />
      </Grid>
    </CockpitPage>
  );
}
