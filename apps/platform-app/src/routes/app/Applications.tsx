import { ClipboardList } from "lucide-react";

import { CockpitPage, EmptyState, Panel } from "@/app/cockpit";

export default function Applications() {
  return (
    <CockpitPage title="Applications" description="Inbound capital applications awaiting review.">
      <Panel padded={false}>
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Applications submitted against your engagements will land here for review and triage."
        />
      </Panel>
    </CockpitPage>
  );
}
