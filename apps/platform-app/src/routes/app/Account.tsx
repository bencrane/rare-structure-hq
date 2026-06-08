import { Card, Grid, Text } from "@rare-structure-hq/ui";

import { CockpitPage } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border-subtle)] py-3 last:border-0">
      <Text size="mono-xs" mono color="subtle">
        {label}
      </Text>
      <Text size="body-sm" color="default" className="truncate">
        {value}
      </Text>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  return (
    <CockpitPage title="Account" description="Your operator profile and engagement billing.">
      <Grid cols={1} mdCols={2} gap="4">
        <Card className="p-5">
          <Text as="h2" size="body-md" color="strong" className="font-semibold">
            Profile
          </Text>
          <div className="mt-3">
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Organization" value="Rare Structure LLC" />
            <Row label="Role" value="Operator" />
          </div>
        </Card>
        <Card className="p-5">
          <Text as="h2" size="body-md" color="strong" className="font-semibold">
            Billing
          </Text>
          <Text size="body-sm" color="muted" className="mt-3">
            Billing is managed by the Rare Structure origination desk. Contact the desk for invoices
            or plan changes.
          </Text>
        </Card>
      </Grid>
    </CockpitPage>
  );
}
