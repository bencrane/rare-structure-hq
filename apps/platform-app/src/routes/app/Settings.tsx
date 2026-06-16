/**
 * Settings — the operator configuration hub.
 *
 * Landing for the /app/settings surface. Each card routes into a child surface:
 * the Proposal Templates register (a table of every authored template) and the
 * markdown authoring editor. The register + editor live under
 * /app/settings/templates/*. This file owns no data — it is pure navigation.
 */
import {
  ChevronRight,
  FileCog,
  FileDown,
  FilePlus2,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
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

      <Section label="Documenso">
        <Grid cols={1} mdCols={2} gap="4">
          <HubCard
            icon={FileSignature}
            title="Documenso Templates"
            description="Open a Documenso template and set default values on its fields. Defaults bake onto the template — every document created from it inherits them."
            cta="Open editor"
            onClick={() => navigate("/app/settings/documenso-templates")}
          />
        </Grid>
      </Section>

      <Section label="Engagement Templates">
        <Grid cols={1} mdCols={2} gap="4">
          <HubCard
            icon={FileDown}
            title="Engagement Templates"
            description="Render a repo-resident engagement template (path → archetype → version) to a clean PDF via DocRaptor. Opens in a new tab; nothing is sent to Documenso."
            cta="Open renderer"
            onClick={() => navigate("/app/settings/engagement-templates")}
          />
        </Grid>
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

// Originate-pathway toggle — selects what "Confirm & Originate" does. Picking a card stages the
// choice locally; the Save button persists it per operator via the BFF (`/api/v1/settings` →
// public.operator_settings), where edge_api reads it at originate.
function OriginationModeCard() {
  const { renderMode, selected, dirty, saving, saved, error, select, save } = useOriginationMode();
  const loading = renderMode === null;
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
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving || loading}
                aria-pressed={active}
                onClick={() => select(opt.value)}
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

        <Inline gap="3" align="center" justify="between">
          <Text size="mono-xs" mono color="muted">
            {loading
              ? "Loading…"
              : saving
                ? "Saving…"
                : error
                  ? error
                  : dirty
                    ? "Unsaved change"
                    : saved
                      ? "Saved"
                      : `Enabled: ${renderMode}`}
          </Text>

          <button
            type="button"
            disabled={!dirty || saving || loading}
            onClick={save}
            className={cx(
              "cursor-pointer border px-4 py-2 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]",
            )}
          >
            <Text size="mono-xs" mono color="accent">
              {saving ? "Saving…" : "Save"}
            </Text>
          </button>
        </Inline>
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
