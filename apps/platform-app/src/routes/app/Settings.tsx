/**
 * Settings — the operator configuration hub.
 *
 * Landing for the /app/settings surface. Each card routes into a child surface:
 * the Proposal Templates register (a table of every authored template) and the
 * markdown authoring editor. The register + editor live under
 * /app/settings/templates/*. This file owns no data — it is pure navigation.
 */
import { ChevronRight, FileCog, FilePlus2, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, Grid, Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { CockpitPage, Section, Tile } from "@/app/cockpit";

export default function Settings() {
  const navigate = useNavigate();

  return (
    <CockpitPage
      title="Settings"
      description="Configure the operator cockpit. Manage the proposal templates used to generate engagement proposals."
    >
      <Section label="Proposal templates">
        <Grid cols={1} mdCols={2} gap="4">
          <HubCard
            icon={FileCog}
            title="Proposal Templates"
            description="Browse the register of every authored template — drafts and published — and open one to edit."
            cta="Open register"
            onClick={() => navigate("/app/settings/templates")}
          />
          <HubCard
            icon={FilePlus2}
            tone="accent"
            title="New Template"
            description="Author a new proposal body in markdown, preview it as a sealed PDF, and publish it to the intake picker."
            cta="Start authoring"
            onClick={() => navigate("/app/settings/templates/new")}
          />
        </Grid>
      </Section>
    </CockpitPage>
  );
}

// ── HubCard — a full-bleed clickable card. Keyboard-operable (Enter/Space) so it
//    reads as a button to assistive tech while filling the card surface.
function HubCard({
  icon: Icon,
  title,
  description,
  cta,
  tone = "default",
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  tone?: "default" | "accent";
  onClick: () => void;
}) {
  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer p-5 outline-none focus-visible:border-[color:var(--color-border-accent)]"
    >
      <Stack gap="4">
        <Tile size="10" tone={tone}>
          <Icon
            className={cx(
              "size-5",
              tone === "accent"
                ? "text-[color:var(--color-text-accent)]"
                : "text-[color:var(--color-text-default)]",
            )}
          />
        </Tile>
        <Stack gap="2">
          <Text size="body-md" color="strong">
            {title}
          </Text>
          <Text size="body-sm" color="muted">
            {description}
          </Text>
        </Stack>
        <Inline gap="1" align="center">
          <Text size="mono-xs" mono color="accent">
            {cta}
          </Text>
          <ChevronRight className="size-3.5 text-[color:var(--color-text-accent)]" />
        </Inline>
      </Stack>
    </Card>
  );
}
