/**
 * Settings → Origination (`/app/settings/origination`).
 *
 * Category surface for the originate pathway: which lane "Confirm & Originate" uses
 * (DocRaptor vs direct-to-Documenso, and the direct-to-Documenso sub-lane) plus the
 * Stripe test/live mode for document payments. The choice is staged locally and
 * persisted per operator via the BFF (`/api/v1/settings` → `public.operator_settings`),
 * where edge_api reads it at originate.
 */
import type { DirectToDocumensoLane, RenderMode, StripeMode } from "@rare-structure-hq/shared";
import { Card, Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage } from "@/app/cockpit";
import { useOriginationMode } from "@/settings/originationMode";

export default function SettingsOrigination() {
  return (
    <CockpitPage
      title="Origination"
      description="How “Confirm &amp; Originate” provisions the agreement — pathway, Documenso lane, and Stripe payment mode. Applies to your account only."
    >
      <BackLink to="/app/settings" label="Settings" />
      <OriginationModeCard />
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

// The direct-to-documenso SUB-LANE — only shown when "Direct to Documenso" is the selected mode.
// Picks which direct-to-documenso lane "Confirm & Originate" uses.
const DIRECT_TO_DOCUMENSO_LANE_OPTIONS: {
  value: DirectToDocumensoLane;
  label: string;
  hint: string;
}[] = [
  {
    value: "envelope-distribute",
    label: "Envelope (distribute)",
    hint: "Instantiate from the template and distribute the envelope. Current behavior.",
  },
  {
    value: "prefill-document-from-template",
    label: "Prefill document from template",
    hint: "Prefill from the opportunity content and originate the document — ready to sign, no email sent.",
  },
  {
    value: "embed-template",
    label: "Embed template (self-serve direct link)",
    hint: "Mint no document — share a reusable direct link; the signer self-identifies and the document is created when they finish signing.",
  },
];

// Document-payment Stripe mode — the test/live toggle. Augments the STRIPE_MODE env so the flow can be
// flipped from the cockpit (no redeploy). `live` is the default; `test` is for exercising the flow.
const STRIPE_MODE_OPTIONS: { value: StripeMode; label: string; hint: string }[] = [
  {
    value: "live",
    label: "Live",
    hint: "Real ACH debits on the live Stripe account. The default for real engagements.",
  },
  {
    value: "test",
    label: "Test",
    hint: "Stripe test mode — test bank accounts, no real money. For exercising the payment flow.",
  },
];

// Originate-pathway toggle — selects what "Confirm & Originate" does. Picking a card stages the
// choice locally; the Save button persists it per operator via the BFF (`/api/v1/settings` →
// public.operator_settings), where edge_api reads it at originate.
function OriginationModeCard() {
  const {
    renderMode,
    selected,
    selectedLane,
    selectedStripeMode,
    dirty,
    saving,
    saved,
    error,
    select,
    selectLane,
    selectStripeMode,
    save,
  } = useOriginationMode();
  const loading = renderMode === null;
  // The sub-lane selector is only relevant under direct-to-documenso (it is ignored by docraptor).
  const showLaneSelector = selected === "direct-to-documenso";
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

        <Inline gap="3" align="stretch">
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

        {showLaneSelector ? (
          <Stack gap="3">
            <Stack gap="1">
              <Text size="mono-xs" mono color="muted">
                Direct-to-Documenso lane
              </Text>
              <Text size="body-sm" color="muted">
                Which Documenso lane “Confirm &amp; Originate” uses. Only applies to Direct to
                Documenso.
              </Text>
            </Stack>
            <Inline gap="3" align="stretch">
              {DIRECT_TO_DOCUMENSO_LANE_OPTIONS.map((opt) => {
                const active = selectedLane === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={saving || loading}
                    aria-pressed={active}
                    onClick={() => selectLane(opt.value)}
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
          </Stack>
        ) : null}

        <Stack gap="3">
          <Stack gap="1">
            <Text size="mono-xs" mono color="muted">
              Payments — Stripe mode
            </Text>
            <Text size="body-sm" color="muted">
              Which Stripe account document payments use. Flip to Test to exercise the flow without
              a real charge; Live for real engagements.
            </Text>
          </Stack>
          <Inline gap="3" align="stretch">
            {STRIPE_MODE_OPTIONS.map((opt) => {
              const active = selectedStripeMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={saving || loading}
                  aria-pressed={active}
                  onClick={() => selectStripeMode(opt.value)}
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
        </Stack>

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
