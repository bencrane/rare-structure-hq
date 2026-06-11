import { Grid, Stack, Text } from "@rare-structure-hq/ui";

import { CockpitPage, DataRow, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/useMe";

export default function Account() {
  const { user, isOperator } = useAuth();
  const { me } = useMe();
  return (
    <CockpitPage title="Account" description="Your profile and billing.">
      <Grid cols={1} mdCols={2} gap="4">
        <Panel>
          <Stack gap="3">
            <Text as="h2" size="body-md" face="display" color="strong">
              Profile
            </Text>
            <div>
              <DataRow label="Email" value={user?.email ?? "—"} />
              <DataRow
                label="Organization"
                value={me?.org?.name ?? (isOperator ? "Rare Structure" : "—")}
              />
              <DataRow label="Role" value={isOperator ? "Operator" : "Client"} />
            </div>
          </Stack>
        </Panel>
        <Panel>
          <Stack gap="3">
            <Text as="h2" size="body-md" face="display" color="strong">
              Billing
            </Text>
            <Text size="body-sm" color="muted">
              Billing is managed by the Rare Structure origination desk. Contact the desk for
              invoices or plan changes.
            </Text>
          </Stack>
        </Panel>
      </Grid>
    </CockpitPage>
  );
}
