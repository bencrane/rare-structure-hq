import { Workflow } from "lucide-react";

import { CockpitPage, EmptyState, Panel } from "@/app/cockpit";

export default function Pipeline() {
  return (
    <CockpitPage title="Pipeline" description="Deals advancing from catalyst signal to engagement.">
      <Panel padded={false}>
        <EmptyState
          icon={Workflow}
          title="No deals in pipeline"
          description="Catalyst signals you advance from the map will stage here as deals move toward an engagement."
        />
      </Panel>
    </CockpitPage>
  );
}
