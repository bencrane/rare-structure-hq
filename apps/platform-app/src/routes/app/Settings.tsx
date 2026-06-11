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

import type { RenderMode } from "@rare-structure-hq/shared";
import { Card, Grid, Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { CockpitPage, Section, Tile } from "@/app/cockpit";
import { useOriginationMode } from "@/settings/originationMode";

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

      <Section label="Origination">
        <OriginationModeCard />
      </Section>
    </CockpitPage>
  );
}

const ORIGINATION_OPTIONS: { value: RenderMode; label: string; hint: string }[] = [
  {
    value: "through-docraptor",
    label: "Through DocRaptor",
    hint: "Render the agreement PDF, then create the Documenso envelope. Current behavior.",
  },
  {
    value: "direct-to-documenso",
    label: "Direct to Documenso",
    hint: "Skip DocRaptor — go straight to Documenso. Prototype pathway (not yet wired).",
  },
];

// Originate-pathway toggle — selects what "Confirm & Originate" does. Persisted per operator via
// the BFF (`/api/v1/settings` → public.operator_settings); edge_api branches on it at originate.
function OriginationModeCard() {
  const { renderMode, saving, error, choose } = useOriginationMode();
  return (
    <Card className="p-5">
      <Stack gap="4">
        <Stack gap="2">
          <Text size="body-md" color="strong">
            Originate pathway
          </Text>
          <Text size="body-sm" color="muted">
            How “Confirm &amp; Originate” provisions the agreement. Applies to your account only.
          </Text>
        </Stack>

        <Inline gap="3">
          {ORIGINATION_OPTIONS.map((opt) => {
            const active = renderMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving || renderMode === null}
                aria-pressed={active}
                onClick={() => choose(opt.value)}
                className={cx(
                  "flex-1 cursor-pointer border p-4 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-border-default)] hover:border-[color:var(--color-text-accent)]",
                )}
              >
                <Stack gap="1">
                  <Inline gap="2" align="center" justify="between">
                    <Text size="mono-xs" mono color="strong">
                      {opt.label}
                    </Text>
                    {active ? (
                      <Text size="mono-xs" mono color="accent">
                        ●
                      </Text>
                    ) : null}
                  </Inline>
                  <Text size="body-sm" color="muted">
                    {opt.hint}
                  </Text>
                </Stack>
              </button>
            );
          })}
        </Inline>

        <Text size="mono-xs" mono color="muted">
          {renderMode === null
            ? "Loading…"
            : saving
              ? "Saving…"
              : error
                ? error
                : `Enabled: ${renderMode}`}
        </Text>
      </Stack>
    </Card>
  );
}

// ── HubCard — a full-bleed clickable card rendered as a semantic <button>, so it is
//    natively keyboard-operable (Enter/Space) and announced as a button to assistive
//    tech. The button owns the behavior; the Card supplies the surface.
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
    <button
      type="button"
      onClick={onClick}
      className="group block w-full cursor-pointer text-left outline-none"
    >
      <Card
        interactive
        className="p-5 group-focus-visible:border-[color:var(--color-border-accent)]"
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
    </button>
  );
}
