/**
 * ManageDocumensoTemplates — Settings → Documenso → "Manage Documenso Templates"
 * (`/app/settings/manage-documenso-templates`).
 *
 * Pick a Documenso template (from the projected MIRROR — business.documenso_envelopes, type='template')
 * and set, per field LABEL: a Default value the field inherits when a document is created from the
 * template, and a Read-only flag locking it from the signer. These live in the OPERATOR-OWNED prefill
 * config (business.documenso_template_document_prefill_configs) — this editor is its ONLY writer; the
 * webhook projector / mirror resync NEVER touch it. The default is NOT baked onto the Documenso
 * template — it is applied at originate LATER (model B: deal override ?? default).
 *
 * `field_settings` is keyed by LABEL and each value is an ARBITRARY dict. Save MERGES into the existing
 * per-label object so unknown keys (Phase 2 "source") survive. Composes CockpitPage — no route geometry.
 */
import { FileSignature, Save } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Stack, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type TemplateMirrorRow,
  listTemplateMirror,
} from "@/settings/documenso-template-mirror-api";
import {
  type TemplatePrefillConfig,
  getPrefillConfig,
  savePrefillConfig,
} from "@/settings/documenso-template-prefill-api";

/** The per-row editor state for one field LABEL (the two Phase-1 inputs). */
interface FieldDraft {
  defaultValue: string;
  readOnly: boolean;
}

/** Seed the editable draft from the saved field_settings (per-label, with Phase-1 defaults). */
function draftFromConfig(config: TemplatePrefillConfig): Record<string, FieldDraft> {
  const draft: Record<string, FieldDraft> = {};
  for (const field of config.fields) {
    const saved = config.field_settings[field.label] ?? {};
    const rawDefault = saved.default_document_field_value;
    draft[field.label] = {
      defaultValue: typeof rawDefault === "string" ? rawDefault : "",
      readOnly: saved.read_only === true,
    };
  }
  return draft;
}

export default function ManageDocumensoTemplates() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  // Template dropdown — the projected mirror list (title + documenso_id).
  const [templates, setTemplates] = useState<TemplateMirrorRow[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // The selected template's fields + saved settings, and the in-progress edits.
  const [config, setConfig] = useState<TemplatePrefillConfig | null>(null);
  const [draft, setDraft] = useState<Record<string, FieldDraft>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    setTemplatesError(null);
    listTemplateMirror(token)
      .then(setTemplates)
      .catch((e) =>
        setTemplatesError(e instanceof Error ? e.message : "Failed to load templates"),
      );
  }, [token]);

  const loadConfig = useCallback(
    (documensoId: number) => {
      setConfigLoading(true);
      setConfig(null);
      setConfigError(null);
      setSaveError(null);
      setSaved(false);
      getPrefillConfig(token, documensoId)
        .then((c) => {
          setConfig(c);
          setDraft(draftFromConfig(c));
        })
        .catch((e) => setConfigError(e instanceof Error ? e.message : "Failed to load fields"))
        .finally(() => setConfigLoading(false));
    },
    [token],
  );

  const onSelect = useCallback(
    (value: string) => {
      setSaved(false);
      if (value === "") {
        setSelectedId(null);
        setConfig(null);
        setConfigError(null);
        return;
      }
      const documensoId = Number.parseInt(value, 10);
      setSelectedId(documensoId);
      loadConfig(documensoId);
    },
    [loadConfig],
  );

  const setDefaultValue = useCallback((label: string, value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [label]: { ...d[label], defaultValue: value } }));
  }, []);

  const setReadOnly = useCallback((label: string, value: boolean) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [label]: { ...d[label], readOnly: value } }));
  }, []);

  const save = useCallback(() => {
    if (!config || selectedId == null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    // MERGE each label's two Phase-1 keys into the EXISTING saved object so any unknown keys
    // (Phase-2 "source") survive the round-trip. Build the full label set from the field list.
    const fieldSettings: Record<string, Record<string, unknown>> = {};
    for (const field of config.fields) {
      const existing = config.field_settings[field.label] ?? {};
      const d = draft[field.label] ?? { defaultValue: "", readOnly: false };
      fieldSettings[field.label] = {
        ...existing,
        default_document_field_value: d.defaultValue,
        read_only: d.readOnly,
      };
    }
    savePrefillConfig(token, selectedId, fieldSettings)
      .then(() => {
        setSaved(true);
        loadConfig(selectedId);
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }, [token, config, selectedId, draft, loadConfig]);

  const options = useMemo(
    () =>
      (templates ?? []).map((t) => ({
        value: String(t.documenso_id),
        label: `${t.title?.trim() || "Untitled"} · #${t.documenso_id}`,
      })),
    [templates],
  );

  return (
    <CockpitPage
      title="Manage Documenso Templates"
      description="Set the default value each field inherits when a document is created from a template, and lock the ones the signer can't change. Defaults are stored here and applied when a document is originated — they are not baked onto the Documenso template."
    >
      <BackLink to="/app/settings/documenso" label="Documenso" />

      <Section label="Template">
        <Panel>
          <FieldLabel label="Documenso template">
            <select
              value={selectedId == null ? "" : String(selectedId)}
              onChange={(e) => onSelect(e.target.value)}
              disabled={templates == null && templatesError == null}
              className={selectCls}
            >
              <option value="">
                {templatesError
                  ? "Couldn’t load templates"
                  : templates == null
                    ? "Loading templates…"
                    : "Select a template…"}
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldLabel>
          {templatesError ? (
            <Text size="mono-xs" mono color="subtle" className="mt-3 block break-words">
              {templatesError}
            </Text>
          ) : null}
        </Panel>
      </Section>

      <Section label="Fields">
        <Panel padded={false}>
          {selectedId == null ? (
            <EmptyState
              icon={FileSignature}
              title="No template selected"
              description="Pick a Documenso template above to set per-field default values and read-only locks."
            />
          ) : configLoading ? (
            <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              Loading…
            </div>
          ) : configError ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load fields
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {configError}
              </Text>
            </div>
          ) : config && config.fields.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No fields"
              description="This template has no fields in the mirror. Re-grab it from the Template Mirror to refresh its fields."
            />
          ) : config ? (
            <div className="divide-y divide-[color:var(--color-border-subtle)]">
              {config.fields.map((field) => {
                const d = draft[field.label] ?? { defaultValue: "", readOnly: false };
                return (
                  <div
                    key={field.label}
                    className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center"
                  >
                    <Stack gap="1">
                      <Text size="body-sm" color="primary" className="break-words">
                        {field.label}
                      </Text>
                      <Text size="mono-xs" mono color="subtle" className="uppercase">
                        {field.type}
                        {field.required ? " · required" : ""}
                      </Text>
                    </Stack>
                    <FieldLabel label="Default value">
                      <input
                        type="text"
                        value={d.defaultValue}
                        onChange={(e) => setDefaultValue(field.label, e.target.value)}
                        placeholder="No default"
                        className={numCls}
                      />
                    </FieldLabel>
                    <label className={checkboxRowCls}>
                      <input
                        type="checkbox"
                        checked={d.readOnly}
                        onChange={(e) => setReadOnly(field.label, e.target.checked)}
                        className="size-4 accent-[color:var(--color-accent-primary)]"
                      />
                      <span className={labelCls}>Read-only</span>
                    </label>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Panel>
      </Section>

      {selectedId != null && config && config.fields.length > 0 ? (
        <div className="flex items-center gap-4">
          <button type="button" onClick={save} disabled={saving} className={saveBtnCls}>
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
          {saved ? (
            <Text size="mono-xs" mono color="accent" className="uppercase tracking-[0.14em]">
              Saved
            </Text>
          ) : null}
          {saveError ? (
            <Text size="mono-xs" mono color="subtle" className="break-words">
              {saveError}
            </Text>
          ) : null}
        </div>
      ) : null}
    </CockpitPage>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="2">
      <span className={labelCls}>{label}</span>
      {children}
    </Stack>
  );
}

const labelCls =
  "flex items-center gap-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const numCls =
  "mt-1.5 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const selectCls = `${numCls} appearance-none`;

const checkboxRowCls =
  "flex cursor-pointer select-none items-center gap-2 md:justify-self-end md:pt-5";

const saveBtnCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";
