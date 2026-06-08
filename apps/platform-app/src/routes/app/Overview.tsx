import { Activity, ClipboardList, FileSignature, Radar, TrendingUp, Workflow } from "lucide-react";

import { Card, Grid } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, SectionLabel, StatCard } from "@/app/cockpit";

export default function Overview() {
  return (
    <CockpitPage
      title="Overview"
      description="Catalyst origination across tracked entities, active pipeline, and engagement proposals."
    >
      <Grid cols={1} mdCols={2} lgCols={3} gap="4">
        <StatCard icon={Radar} label="Entities Tracked" value="4.12M" />
        <StatCard icon={TrendingUp} label="Catalyst Signals" value="—" hint="30d" />
        <StatCard icon={Workflow} label="Active Pipeline" value="—" />
        <StatCard icon={ClipboardList} label="Applications" value="—" />
        <StatCard icon={FileSignature} label="Proposals Out" value="—" />
        <StatCard icon={Activity} label="Engagements" value="—" />
      </Grid>

      <section className="mt-10">
        <SectionLabel>Recent activity</SectionLabel>
        <Card>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Origination, pipeline, and proposal events will stream in here as the desk goes live."
          />
        </Card>
      </section>
    </CockpitPage>
  );
}
