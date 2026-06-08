import { ClipboardList } from "lucide-react";

import { Card } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState } from "@/app/cockpit";

export default function Applications() {
  return (
    <CockpitPage title="Applications" description="Inbound capital applications awaiting review.">
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Applications submitted against your engagements will land here for review and triage."
        />
      </Card>
    </CockpitPage>
  );
}
