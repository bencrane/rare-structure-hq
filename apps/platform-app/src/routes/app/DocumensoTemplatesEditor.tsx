/**
 * DocumensoTemplatesEditor — Settings → Documenso Templates (`/app/settings/documenso-templates`).
 *
 * Pick a Documenso template (the operator-org's visible ones) and set a DEFAULT value for any field.
 * The field set + their current defaults are read LIVE from the Documenso template; saving bakes the
 * defaults back onto the template — every future document created from it inherits them, while the
 * per-deal prefill still overrides. Because the fields come straight from Documenso, this editor
 * never drifts from the real template.
 */
import { ArrowLeft, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type DocumensoTemplateField,
  listDocumensoTemplateFields,
  saveDocumensoTemplateDefaults,
} from "@/settings/documenso-templates-api";
import { type EngagementOption, listEngagementOptions } from "@/staging/api";

type LoadState = "loading" | "ready" | "error";

export default function DocumensoTemplatesEditor() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EngagementOption[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  const [fields, setFields] = useState<DocumensoTemplateField[]>([]);
  const [fieldsState, setFieldsState] = useState<LoadState>("loading");
  const [values, setValues] = useState<Record<number, string>>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 1) the operator-org's templates — the picker.
  useEffect(() => {
    if (!token) return;
    let active = true;
    setState("loading");
    listEngagementOptions(token)
      .then((opts) => {
        if (!active) return;
        setOptions(opts);
        setTemplateId(opts[0]?.id ?? "");
        setState("ready");
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load templates");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // 2) the selected template's live fields + current defaults.
  useEffect(() => {
    if (!token || !templateId) return;
    let active = true;
    setFieldsState("loading");
    setSaved(false);
    setSaveError(null);
    listDocumensoTemplateFields(token, templateId)
      .then((fs) => {
        if (!active) return;
        setFields(fs);
        setValues(Object.fromEntries(fs.map((f) => [f.id, f.default ?? ""])));
        setFieldsState("ready");
      })
      .catch(() => {
        if (!active) return;
        setFieldsState("error");
      });
    return () => {
      active = false;
    };
  }, [token, templateId]);

  const selected = useMemo(
    () => options.find((o) => o.id === templateId) ?? null,
    [options, templateId],
  );

  const setField = useCallback((id: number, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    if (!templateId || fields.length === 0) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const defaults = fields.map((f) => ({ id: f.id, value: values[f.id] ?? "" }));
    saveDocumensoTemplateDefaults(token, templateId, defaults)
      .then((fs) => {
        setFields(fs);
        setValues(Object.fromEntries(fs.map((f) => [f.id, f.default ?? ""])));
        setSaved(true);
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }, [token, templateId, fields, values]);

  return (
    <CockpitPage
      title="Documenso Templates"
      description="Set default values on a Documenso template's fields. Defaults are baked onto the template — every document created from it inherits them; per-deal values still override."
    >
      <button type="button" onClick={() => navigate("/app/settings")} className={backCls}>
        <ArrowLeft className="size-3.5" />
        Settings
      </button>

      {state === "loading" ? (
        <Panel>
          <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
            Loading…
          </div>
        </Panel>
      ) : state === "error" ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <Text size="body-sm">Couldn’t load templates</Text>
            <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
              {error}
            </Text>
          </div>
        </Panel>
      ) : options.length === 0 ? (
        <Panel>
          <div className="px-5 py-16 text-center">
            <Text size="body-sm" color="muted">
              No Documenso templates are available for your org yet.
            </Text>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          <Section label="Template">
            <Panel>
              <label className={labelCls} htmlFor="template">
                Documenso template
              </label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className={selectCls}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {selected && (
                <Text size="mono-xs" mono color="subtle" className="mt-2 block">
                  {selected.archetypeName ?? "Unclassified"} · template {selected.id}
                </Text>
              )}
            </Panel>
          </Section>

          <Section label="Field defaults">
            <Panel>
              {fieldsState === "loading" ? (
                <Text size="mono-xs" mono color="subtle">
                  Loading fields…
                </Text>
              ) : fieldsState === "error" ? (
                <Text size="body-sm" color="muted">
                  Couldn’t load this template’s fields.
                </Text>
              ) : fields.length === 0 ? (
                <Text size="body-sm" color="muted">
                  This template has no editable fields.
                </Text>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.id} className="flex flex-col gap-1.5">
                      <label className={labelCls} htmlFor={`f-${f.id}`}>
                        {f.label ?? `Field ${f.id}`}
                        <span className={typeCls}>{f.type.toLowerCase()}</span>
                      </label>
                      <input
                        id={`f-${f.id}`}
                        type="text"
                        value={values[f.id] ?? ""}
                        onChange={(e) => setField(f.id, e.target.value)}
                        placeholder="No default"
                        className={inputCls}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Section>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || !templateId || fields.length === 0}
              className={saveCls}
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save defaults"}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]">
                <Check className="size-3.5" />
                Saved to template
              </span>
            )}
            {saveError && (
              <Text size="mono-xs" mono color="subtle" className="break-words">
                {saveError}
              </Text>
            )}
          </div>
        </div>
      )}
    </CockpitPage>
  );
}

const backCls =
  "mb-4 inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]";

const labelCls =
  "flex items-center gap-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const typeCls = "font-mono text-[color:var(--color-text-accent)] text-[0.5625rem] tracking-[0.1em]";

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const selectCls = `${inputCls} mt-1.5 cursor-pointer`;

const saveCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";
