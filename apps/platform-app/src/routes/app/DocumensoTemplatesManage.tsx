/**
 * DocumensoTemplatesManage — Settings → Documenso → Set Template as Default
 * (`/app/settings/documenso/templates`).
 *
 * Table of every MIRROR template for the operator (core-x `business.documenso_envelopes`,
 * type='template', non-deleted) via the BFF. The Default column marks ONE as the operator's Confirm &
 * Originate default, recorded in the operator-owned `business.documenso_template_defaults` (one per
 * plane) — NOT baked onto the Documenso template, and NOT the legacy `business.documenso_templates`
 * registry (mirror-path templates like 14503 aren't in it). Override / attach-at-creation / originate
 * wiring are intentionally NOT here yet. Composes CockpitPage — no route geometry.
 */
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Inline, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type TemplateDefaultRow,
  listTemplateDefaults,
  setTemplateDefault,
} from "@/settings/documenso-template-defaults-api";

function statusTone(status: string): "info" | "warn" | "success" {
  if (status === "archived" || status === "cancelled") return "warn";
  if (status === "completed") return "success";
  return "info";
}

export default function DocumensoTemplatesManage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<TemplateDefaultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The current default (the row with is_default), and the operator's local pick before saving.
  const persistedDefaultId = useMemo(
    () => list?.find((t) => t.is_default)?.documenso_id ?? null,
    [list],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listTemplateDefaults(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sync the local pick to the persisted default whenever it changes (initial load + after save).
  // Editing the radio only mutates `selected`, so a pending pick is preserved until save/reload.
  useEffect(() => {
    setSelected(persistedDefaultId);
  }, [persistedDefaultId]);

  const dirty = selected !== persistedDefaultId;

  const save = useCallback(() => {
    if (selected === null || !dirty) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setTemplateDefault(token, selected)
      .then(() => {
        setSaved(true);
        refresh();
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }, [token, selected, dirty, refresh]);

  return (
    <CockpitPage
      title="Set Template as Default"
      description="Every Documenso template from the live mirror. Mark one as the Confirm & Originate default."
    >
      <BackLink to="/app/settings/documenso" label="Documenso" />
      <Section label="Templates">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load templates
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {error}
              </Text>
            </div>
          ) : list === null ? (
            <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              Loading…
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates"
              description="No Documenso templates are mirrored yet. Re-grab them from Template Mirror."
            />
          ) : (
            <>
              <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} template{list.length === 1 ? "" : "s"}
                </Text>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Default</Th>
                      <Th>Template ID</Th>
                      <Th>Name</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((t) => (
                      <tr
                        key={t.documenso_id}
                        className="transition-colors hover:bg-[color:var(--color-surface-raised)]"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="radio"
                            name="default-template"
                            checked={selected === t.documenso_id}
                            disabled={saving}
                            onChange={() => {
                              setSelected(t.documenso_id);
                              setSaved(false);
                            }}
                            aria-label={`Set ${t.title ?? t.documenso_id} as the default template`}
                            className="size-4 cursor-pointer accent-[color:var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Text size="mono-xs" mono color="subtle">
                            {t.documenso_id}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="body-sm" color="primary" className="block truncate">
                            {t.title ?? "—"}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          {t.status ? (
                            <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                          ) : (
                            <Text size="body-sm" color="muted">
                              —
                            </Text>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </Section>

      {list && list.length > 0 ? (
        <Inline gap="3" align="center" justify="between">
          <Text size="mono-xs" mono color="muted">
            {saving
              ? "Saving…"
              : saveError
                ? saveError
                : saved
                  ? "Saved"
                  : dirty
                    ? "Unsaved change"
                    : persistedDefaultId !== null
                      ? `Default: ${persistedDefaultId}`
                      : "No default set"}
          </Text>
          <button type="button" disabled={!dirty || saving} onClick={save} className={saveBtnCls}>
            {saving ? "Saving…" : "Save default"}
          </button>
        </Inline>
      ) : null}
    </CockpitPage>
  );
}

function Th({ children }: { children?: ReactNode }) {
  return <th className={thCls}>{children}</th>;
}

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const saveBtnCls =
  "cursor-pointer border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-4 py-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";
