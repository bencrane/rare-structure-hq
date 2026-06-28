/**
 * DocumensoTemplatesManage — Settings → Documenso → Manage Templates
 * (`/app/settings/documenso/templates`).
 *
 * Table of EVERY Documenso template for the operator's org (active AND archived), from core-x
 * `business.documenso_templates` via the BFF. The Default column marks ONE template as the org's
 * Confirm & Originate default (active templates only) — recorded in the DB (`documenso_templates.
 * is_default`, one per org). Override / attach-at-creation / originate wiring are intentionally NOT
 * here yet. Composes CockpitPage — no route geometry.
 */
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DocumensoTemplateSummary } from "@rare-structure-hq/shared";
import { Badge, Inline, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  listDocumensoTemplates,
  setDefaultDocumensoTemplate,
} from "@/settings/documenso-templates-api";

function statusTone(status: string): "info" | "warn" | "success" {
  return status === "archived" ? "warn" : "success";
}

export default function DocumensoTemplatesManage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<DocumensoTemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The current DB default (the row with is_default), and the operator's local pick before saving.
  const persistedDefaultId = useMemo(() => list?.find((t) => t.isDefault)?.id ?? null, [list]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listDocumensoTemplates(token)
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
    if (!selected || !dirty) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setDefaultDocumensoTemplate(token, selected)
      .then(() => {
        setSaved(true);
        refresh();
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }, [token, selected, dirty, refresh]);

  return (
    <CockpitPage
      title="Manage Templates"
      description="Every Documenso template registered for your org — active and archived. Mark one as the Confirm & Originate default."
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
              description="No Documenso templates are registered for your org yet."
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
                      <Th>Archetype</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((t) => {
                      const selectable = t.status === "active";
                      return (
                        <tr
                          key={t.id}
                          className="transition-colors hover:bg-[color:var(--color-surface-raised)]"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="radio"
                              name="default-template"
                              checked={selected === t.id}
                              disabled={!selectable || saving}
                              onChange={() => {
                                setSelected(t.id);
                                setSaved(false);
                              }}
                              aria-label={`Set ${t.name} as the default template`}
                              title={
                                selectable ? undefined : "Archived templates can’t be the default"
                              }
                              className="size-4 cursor-pointer accent-[color:var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Text size="mono-xs" mono color="subtle">
                              {t.id}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            <Text size="body-sm" color="primary" className="block truncate">
                              {t.name}
                            </Text>
                            {t.slug ? (
                              <Text size="mono-xs" mono color="subtle" className="block truncate">
                                {t.slug}
                              </Text>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Text size="body-sm" color="muted">
                              {t.archetypeName ?? "—"}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
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
                    : persistedDefaultId
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
