import { Stack, Text } from "@rare-structure-hq/ui";

import { CockpitPage, DataRow, Panel } from "@/app/cockpit";

export default function Preferences() {
  return (
    <CockpitPage
      title="Preferences"
      description="Notification and display settings for your portal."
    >
      <Panel>
        <Stack gap="3">
          <Text as="h2" size="body-md" face="display" color="strong">
            Notifications
          </Text>
          <div>
            <DataRow label="Email updates" value="Enabled" />
            <DataRow label="Engagement alerts" value="Enabled" />
          </div>
        </Stack>
      </Panel>
    </CockpitPage>
  );
}
